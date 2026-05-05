export class UserProfile {
  private constructor(
    readonly displayName: string,
    readonly email: string,
    readonly photoURL: string | null,
  ) {}

  static create(
    displayName: string,
    email: string,
    photoURL: string | null,
  ): UserProfile {
    if (displayName.length === 0) {
      throw new Error("displayName must not be empty");
    }
    if (!isValidEmail(email)) {
      throw new Error(`invalid email: ${email}`);
    }
    if (photoURL !== null && !photoURL.startsWith("https://")) {
      throw new Error(`photoURL must use https:// scheme (got: ${photoURL})`);
    }
    return new UserProfile(displayName, email, photoURL);
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
