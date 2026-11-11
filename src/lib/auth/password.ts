import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: string | undefined;

/**
 * Compare against a throwaway hash when the email is unknown, so a login
 * attempt takes the same time whether or not the account exists.
 */
export async function burnPasswordCheck(plain: string): Promise<false> {
  dummyHash ??= await bcrypt.hash("keyvaga-timing-guard", COST);
  await bcrypt.compare(plain, dummyHash);
  return false;
}
