/** Round to 2 decimals and drop floating point noise (e.g. 1234.5600000000002 -> 1234.56). */
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Number -> string for display/PDF: integers stay integers, fractions get at most 2 decimals. */
export const formatMoney = (n) => String(round2(n));
