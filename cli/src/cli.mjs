#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, requiredFlag } from "./lib/args.mjs";
import { fetchDatasetPackageMetadata } from "./lib/backend.mjs";
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
  const apiKey = resolveConfig(flags["api-key"], process.env.BURSTCHESTER_FIREBASE_API_KEY);

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
  const apiKey = requiredConfig(flags["api-key"], process.env.BURSTCHESTER_FIREBASE_API_KEY, "api-key");
  const profileUrl = requiredConfig(flags["profile-url"], process.env.BURSTCHESTER_PROFILE_URL, "profile-url");
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
    const googleClientId = requiredConfig(
      flags["google-client-id"],
      process.env.BURSTCHESTER_GOOGLE_CLIENT_ID,
      "google-client-id",
    );
    const googleClientSecret = requiredConfig(
      flags["google-client-secret"],
      process.env.BURSTCHESTER_GOOGLE_CLIENT_SECRET,
      "google-client-secret",
    );

    const device = await startGoogleDeviceFlow({
      clientId: googleClientId,
    });

    process.stdout.write(
      [
        "Google 로그인 승인 필요",
        `브라우저에서 ${device.verification_url} 를 열고 코드 ${device.user_code} 를 입력하세요.`,
        "",
      ].join("\n"),
    );

    const googleTokens = await pollGoogleDeviceFlow({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      deviceCode: device.device_code,
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
  const endpointUrl = requiredFlag(flags, "backend-url");
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

async function handleTrain(flags) {
  const endpointUrl = requiredFlag(flags, "backend-url");
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
      "  auth profile --display-name <name> --api-key <firebase-key> --profile-url <url>",
      "  auth logout",
      "  download-dataset --backend-url <url> --dataset-id <id> [--out-dir <dir>] [--extract false]",
      "  download-model --url <hf-url> [--out-dir <dir>]",
      "  download-model --repo <org/model> --file <filename> [--revision <rev>] [--out-dir <dir>]",
      "  train --backend-url <url> --dataset-id <id> --model-repo <org/model> [--workspace <dir>]",
      "",
    ].join("\n"),
  );
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

function requiredConfig(flagValue, envValue, name) {
  const value = resolveConfig(flagValue, envValue);
  if (!value) {
    throw new Error(`Missing required flag or env for ${name}`);
  }

  return value;
}

function optionalConfig(flagValue, envValue) {
  const value = resolveConfig(flagValue, envValue);
  return value || null;
}

function resolveConfig(flagValue, envValue) {
  if (typeof flagValue === "string" && flagValue.trim()) {
    return flagValue.trim();
  }

  if (typeof envValue === "string" && envValue.trim()) {
    return envValue.trim();
  }

  return "";
}
