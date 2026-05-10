export function buildProfileHref(uid: string): string {
  const params = new URLSearchParams({ user: uid });
  return `/profile?${params.toString()}`;
}
