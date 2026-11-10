// The original markup relies heavily on inline `style="..."` strings (and the stylesheet has
// attribute selectors such as [style*="grid-template-columns: 1fr 1fr"]). To keep the UI
// pixel-identical the same style strings are kept and converted to React style objects here.
const cache = new Map();

function splitDeclarations(str) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ';' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function css(str) {
  if (cache.has(str)) return cache.get(str);
  const style = {};
  splitDeclarations(str).forEach((decl) => {
    const idx = decl.indexOf(':');
    if (idx < 0) return;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).replace(/!important/g, '').trim();
    if (!prop || !value) return;
    const key = prop.startsWith('--')
      ? prop
      : prop.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^webkit/, 'Webkit');
    style[key] = value;
  });
  cache.set(str, style);
  return style;
}
