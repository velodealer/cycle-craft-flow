// VeloDealer super admins: the only people who can see sensitive delivery settings
// (email sender address, link address) inside Settings.
export const SUPER_ADMIN_EMAILS: string[] = [
  'abdnhussain@gmail.com',
];

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === email.trim().toLowerCase());
}
