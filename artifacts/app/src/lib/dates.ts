// YYYY-MM-DD (optionally followed by a time) -> MM/DD/YYYY. Anything else is returned unchanged.
export function fmtDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s
}

// MM/DD/YYYY -> YYYY-MM-DD ("" if not a valid date)
export function parseUsDate(s: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!m) return ""
  const [, mo, d, y] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  if (dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) return ""
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
}
