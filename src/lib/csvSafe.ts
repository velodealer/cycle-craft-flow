// Pure, import-free so Deno tests use the same code.
/** Stops spreadsheet apps running text that starts like a formula (=, +, -, @, tab). Plain numbers are left alone. */
export function neutraliseFormula(s: string): string {
  if (!/^[=+\-@\t\r]/.test(s)) return s;
  if (/^[+-]?\d+(\.\d+)?$/.test(s.trim())) return s;
  return `'${s}`;
}
