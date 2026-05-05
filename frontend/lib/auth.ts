import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "@/lib/firebase";
import { buildInitialProfileDoc, type AuthUser } from "@/lib/users/seed";

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  await ensureUserProfile(result.user, getDb(), new Date());
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export async function ensureUserProfile(
  user: FirebaseUser,
  db: Firestore,
  now: Date,
): Promise<void> {
  if (!user.uid) {
    throw new Error("ensureUserProfile requires a user with a uid");
  }
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  const authUser: AuthUser = {
    uid: user.uid,
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    photoURL: user.photoURL,
  };
  const seed = buildInitialProfileDoc(authUser, now);
  await setDoc(ref, seed);
}
