export function isOrganizerEmailAllowed(
  email: string | null | undefined,
  configuredEmails = process.env.ORGANIZER_EMAILS ?? '',
): boolean {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  const allowlist = configuredEmails
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(normalizedEmail);
}
