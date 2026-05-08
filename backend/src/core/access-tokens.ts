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
    token: `${TOKEN_PREFIX}_${id}_${secret}`,
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
  getRecord: (tokenId: string) => Promise<UserAccessTokenRecord | null>,
): Promise<{ uid: string; tokenId: string }> {
  const parsed = parseUserAccessToken(token);
  const record = await getRecord(parsed.id);
  if (!record || record.revokedAt) {
    throw new Error("Invalid access token.");
  }

  if (!secureEqual(record.secretHash, hashTokenSecret(parsed.secret))) {
    throw new Error("Invalid access token.");
  }

  return Object.freeze({ uid: record.ownerUid, tokenId: record.id });
}

export function parseUserAccessToken(token: string): { id: string; secret: string } {
  const [prefix, id, ...secretParts] = token.split("_");
  const secret = secretParts.join("_");
  if (prefix !== TOKEN_PREFIX || !id || !secret) {
    throw new Error("Invalid access token.");
  }
  return { id, secret };
}

function hashTokenSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer)
  );
}
