const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the visitor's local timezone. */
export function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal() {
  return localISODate(new Date());
}

export function tomorrowLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localISODate(d);
}

/** 1234 -> "1234", 1234.5600000001 -> "1234.56" */
export function money(n) {
  const v = Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  return String(v);
}

export const plural = (n, word, suffix = 's') => `${word}${n > 1 ? suffix : ''}`;

export const slug = (roomType) => String(roomType).replace(/\s+/g, '-');

export function downloadBase64File({ filename, mime, data }) {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
