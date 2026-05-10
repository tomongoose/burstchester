import { createHash, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

export interface UserAccessTokenRecord {
  readonly id: string;
  readonly ownerUid: string;
  readonly label: string;
  readonly secretHash: string;
  readonly createdAt: Timestamp;
  readonly lastUsedAt?: Timestamp;
  readonly revokedAt?: Timestamp | null;
}

export interface IssuedUserAccessToken {
  readonly token: string;
  readonly record: UserAccessTokenRecord;
}

const TOKEN_PREFIX = "bst";

export function buildUserAccessToken(
  input: { uid: string; label?: string },
  idFactory: () => string,
  secretFactory: () => string,
  now: Timestamp,
): IssuedUserAccessToken {
  const id = idFactory().trim();
  const secret = secretFactory().trim();
  if (!id || !secret) {
    throw new Error("Access token id and secret are required.");
  }

  return Object.freeze({
    token: `${TOKEN_PREFIX}_${encodeTokenPart(input.uid)}_${id}_${secret}`,
    record: Object.freeze({
      id,
      ownerUid: input.uid,
      label: input.label?.trim() || "CLI access token",
      secretHash: hashTokenSecret(secret),
      createdAt: now,
      revokedAt: null,
    }),
  });
}

export async function verifyUserAccessToken(
  token: string,
  getRecord: (uid: string, tokenId: string) => Promise<UserAccessTokenRecord | null>,
): Promise<{ uid: string; tokenId: string }> {
  const parsed = parseUserAccessToken(token);
  const record = await getRecord(parsed.uid, parsed.id);
  if (!record || record.revokedAt) {
    throw new Error("Invalid access token.");
  }

  if (record.ownerUid !== parsed.uid || record.id !== parsed.id) {
    throw new Error("Invalid access token.");
  }

  if (!secureEqual(record.secretHash, hashTokenSecret(parsed.secret))) {
    throw new Error("Invalid access token.");
  }

  return Object.freeze({ uid: record.ownerUid, tokenId: record.id });
}

export function parseUserAccessToken(token: string): { uid: string; id: string; secret: string } {
  const [prefix, encodedUid, id, ...secretParts] = token.split("_");
  const secret = secretParts.join("_");
  if (prefix !== TOKEN_PREFIX || !encodedUid || !id || !secret) {
    throw new Error("Invalid access token.");
  }
  return { uid: decodeTokenPart(encodedUid), id, secret };
}

function hashTokenSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function encodeTokenPart(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeTokenPart(value: string): string {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  if (!decoded) {
    throw new Error("Invalid access token.");
  }
  return decoded;
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer)
  );
}
