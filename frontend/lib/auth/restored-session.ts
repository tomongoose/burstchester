interface RestoredAuthUser {
  readonly uid: string;
  readonly isAnonymous?: boolean;
  readonly getIdToken: () => Promise<string>;
}

export async function validateRestoredLoginUser(
  user: RestoredAuthUser | null,
): Promise<Pick<RestoredAuthUser, "uid"> | null> {
  if (!user || user.isAnonymous) return null;

  const token = await user.getIdToken();
  return token ? { uid: user.uid } : null;
}
