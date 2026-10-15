// Text context keeps an attachment on the intended phrase after nearby edits.
export function resolveQuote(text, anchor) {
  if (!anchor?.quote) return -1;
  const matches = [];
  for (
    let start = text.indexOf(anchor.quote);
    start !== -1;
    start = text.indexOf(anchor.quote, start + 1)
  )
    matches.push(start);
  if (matches.length === 1) return matches[0];
  const contextual = matches.filter(
    (start) =>
      (!anchor.before || text.slice(0, start).endsWith(anchor.before)) &&
      (!anchor.after ||
        text.slice(start + anchor.quote.length).startsWith(anchor.after)),
  );
  return contextual.length === 1 ? contextual[0] : -1;
}
