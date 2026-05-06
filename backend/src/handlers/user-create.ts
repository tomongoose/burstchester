import * as functionsV1 from "firebase-functions/v1";
import { buildUserProfile } from "../core/profiles";
import type { HandlerDeps } from "./deps";

export function createOnUserCreate(deps: Pick<HandlerDeps, "db" | "clock">) {
  return functionsV1.auth.user().onCreate(async (user) => {
    const profile = buildUserProfile(user, deps.clock.now());
    await deps.db.doc(`users/${user.uid}`).set(profile, { merge: true });
  });
}
