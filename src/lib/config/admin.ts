/**
 * Admin Configuration & Access Control
 *
 * Configures authorized administrator accounts and permissions.
 */

export const PRIMARY_ADMIN_EMAIL = "mihika3109@gmail.com";

export const AUTHORIZED_ADMIN_EMAILS: string[] = [
  PRIMARY_ADMIN_EMAIL,
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()) : []),
];

/**
 * Checks whether an email is an authorized Sprout administrator.
 */
export function isAuthorizedAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return AUTHORIZED_ADMIN_EMAILS.includes(normalized);
}
