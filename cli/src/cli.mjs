#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, requiredFlag } from "./lib/args.mjs";
import { fetchDatasetPackageMetadata, uploadDebugDataset } from "./lib/backend.mjs";
import { BURSTCHESTER_DEFAULTS } from "./lib/default-config.mjs";
import { downloadToFile, ensureDir } from "./lib/download.mjs";
import {
  decodeJwtPayload,
  isSessionExpired,
  linkGoogleAccount,
  refreshFirebaseSession,
  signInAnonymously,
} from "./lib/firebase-auth.mjs";
import { pollGoogleDeviceFlow, startGoogleDeviceFlow } from "./lib/google-device.mjs";
import { downloadHuggingFaceFile } from "./lib/huggingface.mjs";
import { upsertCliProfile } from "./lib/profile.mjs";
import { clearSession, loadSession, saveSession } from "./lib/session.mjs";
import { buildTrainingManifest, runTraining } from "./lib/train.mjs";
import { extractStoredZip } from "./lib/zip.mjs";

const ROOT_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function main(argv) {
  const { command, flags, positionals } = parseArgs(argv);

  switch (command) {
    case "auth":
      await handleAuth(flags, positionals);
      return;
    case "download-dataset":
      await handleDownloadDataset(flags);
      return;
    case "download-model":
      await handleDownloadModel(flags);
      return;
    case "upload-test-dataset":
      await handleUploadTestDataset(flags);
      return;
    case "train":
      await handleTrain(flags);
      return;
    default:
      printUsage();
  }
}

async function handleAuth(flags, positionals) {
  const subcommand = positionals[0] || "status";

  switch (subcommand) {
    case "status":
      await handleAuthStatus(flags);
      return;
    case "profile":
      await handleAuthProfile(flags);
      return;
    case "logout":
      await clearSession();
      process.stdout.write(`${JSON.stringify({ ok: true, signedOut: true }, null, 2)}\n`);
      return;
    default:
      throw new Error(`Unknown auth subcommand: ${subcommand}`);
  }
}

async function handleAuthStatus(flags) {
  let session = await loadSession();
  const apiKey = resolveConfig(
    flags["api-key"],
    process.env.BURSTCHESTER_FIREBASE_API_KEY,
    BURSTCHESTER_DEFAULTS.firebaseConfig.apiKey,
  );

  if (!session) {
    process.stdout.write(`${JSON.stringify({ signedIn: false }, null, 2)}\n`);
    return;
  }

  if (apiKey && isSessionExpired(session)) {
    session = {
      ...session,
      ...await refreshFirebaseSession({
        apiKey,
        refreshToken: session.refreshToken,
      }),
    };
    await saveSession(session);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        signedIn: true,
        userId: session.userId,
        isAnonymous: Boolean(session.isAnonymous),
        providerId: session.providerId,
        email: session.email || "",
      },
      null,
      2,
    )}\n`,
  );
}

async function handleAuthProfile(flags) {
  const apiKey = requiredConfig(
    flags["api-key"],
    process.env.BURSTCHESTER_FIREBASE_API_KEY,
    "api-key",
    BURSTCHESTER_DEFAULTS.firebaseConfig.apiKey,
  );
  const profileUrl = requiredConfig(
    flags["profile-url"],
    process.env.BURSTCHESTER_PROFILE_URL,
    "profile-url",
    BURSTCHESTER_DEFAULTS.profileUrl,
  );
  const googleAuthUrl = requiredConfig(
    flags["google-auth-url"],
    process.env.BURSTCHESTER_GOOGLE_AUTH_URL,
    "google-auth-url",
    BURSTCHESTER_DEFAULTS.googleAuthUrl,
  );
  const displayName = requiredFlag(flags, "display-name");
  const photoURL = optionalConfig(flags["photo-url"], process.env.BURSTCHESTER_PROFILE_PHOTO_URL);

  let session = await loadSession();
  if (!session) {
    session = await signInAnonymously({ apiKey });
  } else if (isSessionExpired(session)) {
    session = {
      ...session,
      ...await refreshFirebaseSession({
        apiKey,
        refreshToken: session.refreshToken,
      }),
    };
  }

  let profile = await upsertCliProfile({
    profileUrl,
    idToken: session.idToken,
    displayName,
    photoURL,
  });

  let upgraded = false;
  if (session.isAnonymous) {
    const device = await startGoogleDeviceFlow({
      authUrl: googleAuthUrl,
      firebaseIdToken: session.idToken,
    });

    process.stdout.write(
      [
        "Google 로그인 승인 필요",
        `브라우저에서 ${device.verificationUrl} 를 열고 코드 ${device.userCode} 를 입력하세요.`,
        "",
      ].join("\n"),
    );

    const googleTokens = await pollGoogleDeviceFlow({
      authUrl: googleAuthUrl,
      firebaseIdToken: session.idToken,
      deviceCode: device.deviceCode,
      interval: device.interval,
    });

    session = {
      ...await linkGoogleAccount({
        apiKey,
        firebaseIdToken: session.idToken,
        googleIdToken: googleTokens.id_token,
      }),
    };

    const googleProfile = decodeJwtPayload(googleTokens.id_token);
    profile = await upsertCliProfile({
      profileUrl,
      idToken: session.idToken,
      displayName,
      photoURL: photoURL || googleProfile.picture || null,
    });

    session.email = googleProfile.email || profile.email || "";
    session.providerId = "google.com";
    session.isAnonymous = false;
    upgraded = true;
  }

  session.displayName = profile.displayName;
  session.photoURL = profile.photoURL;
  session.email = profile.email || session.email || "";
  await saveSession(session);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        upgraded,
        auth: {
          userId: session.userId,
          isAnonymous: session.isAnonymous,
          providerId: session.providerId,
          email: session.email || "",
        },
        profile,
      },
      null,
      2,
    )}\n`,
  );
}

async function handleDownloadDataset(flags) {
  const endpointUrl = resolveConfig(
    flags["backend-url"],
    process.env.BURSTCHESTER_BACKEND_URL,
    BURSTCHESTER_DEFAULTS.datasetDownloadUrl,
  );
  const datasetId = requiredFlag(flags, "dataset-id");
  const outDir = resolve(String(flags["out-dir"] || join(ROOT_DIR, "artifacts", "datasets", datasetId)));
  const extract = flags.extract !== "false";

  const metadata = await fetchDatasetPackageMetadata({
    endpointUrl,
    datasetId,
  });

  await ensureDir(outDir);
  const zipPath = join(outDir, `${datasetId}.zip`);
  await downloadToFile({
    url: metadata.url,
    destination: zipPath,
  });

  let extractedDir = null;
  if (extract) {
    extractedDir = join(outDir, datasetId);
    const archive = await readFile(zipPath);
    await extractStoredZip(archive, extractedDir);
  }

  process.stdout.write(
    `${JSON.stringify({ datasetId, zipPath, extractedDir, downloadUrl: metadata.url }, null, 2)}\n`,
  );
}

async function handleDownloadModel(flags) {
  const outDir = resolve(String(flags["out-dir"] || join(ROOT_DIR, "artifacts", "models")));
  const url = typeof flags.url === "string" ? flags.url : undefined;
  const repo = typeof flags.repo === "string" ? flags.repo : undefined;
  const file = typeof flags.file === "string" ? flags.file : undefined;
  const revision = typeof flags.revision === "string" ? flags.revision : "main";

  if (!url && !(repo && file)) {
    throw new Error("download-model requires --url or --repo with --file");
  }

  const result = await downloadHuggingFaceFile({
    url,
    repo,
    file,
    revision,
    outDir,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function handleUploadTestDataset(flags) {
  let session = await loadSession();
  if (!session) {
    throw new Error("No CLI session found. Run `auth profile --display-name ...` first.");
  }

  const apiKey = resolveConfig(
    flags["api-key"],
    process.env.BURSTCHESTER_FIREBASE_API_KEY,
    BURSTCHESTER_DEFAULTS.firebaseConfig.apiKey,
  );
  if (isSessionExpired(session)) {
    session = {
      ...session,
      ...await refreshFirebaseSession({
        apiKey,
        refreshToken: session.refreshToken,
      }),
    };
    await saveSession(session);
  }

  const endpointUrl = resolveConfig(
    flags["upload-url"],
    process.env.BURSTCHESTER_DEBUG_UPLOAD_URL,
    BURSTCHESTER_DEFAULTS.debugUploadUrl,
  );
  const filePath = requiredFlag(flags, "file");
  const filename = typeof flags.filename === "string" && flags.filename.trim()
    ? flags.filename.trim()
    : filePath.split("/").at(-1) || "debug.jsonl";
  const content = await readFile(resolve(filePath), "utf8");

  const dataset = await uploadDebugDataset({
    endpointUrl,
    idToken: session.idToken,
    filename,
    content,
    metadata: {
      datasetId: typeof flags["dataset-id"] === "string" ? flags["dataset-id"] : undefined,
      title: typeof flags.title === "string" ? flags.title : undefined,
      description: typeof flags.description === "string" ? flags.description : undefined,
      tags: typeof flags.tags === "string" ? flags.tags : undefined,
      baseModelHint: typeof flags["base-model-hint"] === "string" ? flags["base-model-hint"] : undefined,
      taskType: typeof flags["task-type"] === "string" ? flags["task-type"] : undefined,
      language: typeof flags.language === "string" ? flags.language : undefined,
      license: typeof flags.license === "string" ? flags.license : undefined,
      sourceModel: typeof flags["source-model"] === "string" ? flags["source-model"] : undefined,
      outputModelId: typeof flags["output-model-id"] === "string" ? flags["output-model-id"] : undefined,
    },
  });

  process.stdout.write(`${JSON.stringify({ ok: true, dataset }, null, 2)}\n`);
}

async function handleTrain(flags) {
  const endpointUrl = resolveConfig(
    flags["backend-url"],
    process.env.BURSTCHESTER_BACKEND_URL,
    BURSTCHESTER_DEFAULTS.datasetDownloadUrl,
  );
  const datasetId = requiredFlag(flags, "dataset-id");
  const modelRepo = requiredFlag(flags, "model-repo");
  const workspace = resolve(String(flags.workspace || join(ROOT_DIR, "artifacts", "training", datasetId)));
  const pythonBin = typeof flags.python === "string" ? flags.python : "python3";
  const trainingMethod = typeof flags["training-method"] === "string" ? flags["training-method"] : "qlora";

  await ensureDir(workspace);

  const metadata = await fetchDatasetPackageMetadata({
    endpointUrl,
    datasetId,
  });

  const zipPath = join(workspace, `${datasetId}.zip`);
  await downloadToFile({
    url: metadata.url,
    destination: zipPath,
  });

  const datasetDir = join(workspace, "dataset");
  const archive = await readFile(zipPath);
  await extractStoredZip(archive, datasetDir);

  const manifest = buildTrainingManifest({
    datasetId,
    datasetPath: join(datasetDir, "dataset.jsonl"),
    modelRepo,
    outputDir: join(workspace, "output"),
    trainingMethod,
    numTrainEpochs: flags.epochs,
    perDeviceTrainBatchSize: flags["batch-size"],
    gradientAccumulationSteps: flags["grad-accum"],
    learningRate: flags["learning-rate"],
    maxSeqLength: flags["max-seq-length"],
    loraRank: flags["lora-rank"],
    loraAlpha: flags["lora-alpha"],
    loraDropout: flags["lora-dropout"],
    loggingSteps: flags["logging-steps"],
    saveSteps: flags["save-steps"],
  });

  const result = await runTraining({
    manifest,
    workDir: workspace,
    pythonBin,
  });

  process.stdout.write(
    `${JSON.stringify({ datasetId, modelRepo, workspace, outputDir: manifest.outputDir, ...result }, null, 2)}\n`,
  );
}

function printUsage() {
  process.stdout.write(
    [
      "Burstchester CLI",
      "",
      "Commands:",
      "  auth status",
      "  auth profile --display-name <name> --api-key <firebase-key> --profile-url <url> --google-auth-url <url>",
      "  auth logout",
      "  download-dataset [--backend-url <url>] --dataset-id <id> [--out-dir <dir>] [--extract false]",
      "  download-model --url <hf-url> [--out-dir <dir>]",
      "  download-model --repo <org/model> --file <filename> [--revision <rev>] [--out-dir <dir>]",
      "  upload-test-dataset --file <path> [--dataset-id <id>] [--title <title>] [--upload-url <url>]",
      "  train [--backend-url <url>] --dataset-id <id> --model-repo <org/model> [--workspace <dir>]",
      "",
    ].join("\n"),
  );
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

function requiredConfig(flagValue, envValue, name, defaultValue = "") {
  const value = resolveConfig(flagValue, envValue, defaultValue);
  if (!value) {
    throw new Error(`Missing required flag or env for ${name}`);
  }

  return value;
}

function optionalConfig(flagValue, envValue, defaultValue = "") {
  const value = resolveConfig(flagValue, envValue, defaultValue);
  return value || null;
}

function resolveConfig(flagValue, envValue, defaultValue = "") {
  if (typeof flagValue === "string" && flagValue.trim()) {
    return flagValue.trim();
  }

  if (typeof envValue === "string" && envValue.trim()) {
    return envValue.trim();
  }

  if (typeof defaultValue === "string" && defaultValue.trim()) {
    return defaultValue.trim();
  }

  return "";
}
