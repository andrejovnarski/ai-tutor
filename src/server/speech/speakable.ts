/** The text Nova speaks: the line with {name} removed (the name never reaches the speech service). */
export function speakable(say: string): string {
  let s = say
    .replace(/\{name\}\s*,\s*/g, "")
    .replace(/\s*,?\s*\{name\}/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?:;])/g, "$1")
    .trim();
  s = s.replace(/^[,\s]+/, "");
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  return s;
}
