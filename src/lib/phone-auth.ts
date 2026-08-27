/**
 * Phone-first authentication.
 *
 * The application never asks for an email address. A phone number is the only
 * identifier: it is normalised to digits and paired with a password.
 * Internally the account is keyed by a stable, non-deliverable identifier
 * derived from that number, so no email is ever collected, shown or sent.
 */

export const PHONE_DOMAIN = "bizz.local";

/** Keeps digits only (accepts 0xxx, +255xxx, spaces, dashes). */
export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return `255${digits.slice(1)}`;
  return digits;
}

export function isValidPhone(input: string): boolean {
  const digits = normalizePhone(input);
  return digits.length >= 9 && digits.length <= 15;
}

/** Display form: +255 7XX XXX XXX */
export function formatPhone(input: string): string {
  const digits = normalizePhone(input);
  return digits ? `+${digits}` : "";
}

/** Internal account identifier derived from the phone number. */
export function phoneIdentity(input: string): string {
  return `${normalizePhone(input)}@${PHONE_DOMAIN}`;
}
