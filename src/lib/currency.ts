/**
 * SAR formatting. Thmanyah ships the NEW official Saudi Riyal symbol on
 * U+FDFC (﷼) — so inside Thmanyah-rendered text we use the character
 * itself. Use <RiyalSymbol /> (SVG) only where the font isn't guaranteed.
 */
export const RIYAL = "﷼";

const nf = new Intl.NumberFormat("ar-u-nu-latn", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** 1250 → "1,250 ﷼" (Latin digits, Arabic grouping). */
export function formatSAR(amount: number): string {
  return `${nf.format(amount)} ${RIYAL}`;
}
