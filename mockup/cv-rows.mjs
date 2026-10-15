export const rowLayouts = {
  contact: "text",
  languages: "language",
  certificates: "list",
  education: "timeline",
  experience: "timeline",
  skills: "list",
  interests: "list",
};
const text = (value) => (typeof value === "string" ? value.slice(0, 5000) : "");
const image = (value) =>
  /^data:image\/(png|jpeg|webp);base64,/.test(value || "") &&
  value.length < 1500000
    ? value
    : "";
export function normalizeRows(
  saved,
  values,
  makeId = () => crypto.randomUUID(),
) {
  return Object.fromEntries(
    Object.entries(rowLayouts).map(([field, layout]) => {
      const valid = Array.isArray(saved?.[field]) ? saved[field] : null;
      const source =
        valid ||
        (layout === "timeline"
          ? [
              {
                title: values[field]?.split("\n")[0],
                detail: values[field]?.split("\n")[1],
                body: values[field]?.split("\n").slice(2).join("\n"),
                date: "Dates",
              },
            ]
          : (values[field] || "")
              .split("\n")
              .filter(Boolean)
              .map((title) => ({ title })));
      const used = new Set();
      return [
        field,
        source.slice(0, 100).map((row) => {
          const id =
            /^[a-f0-9-]{36}$/i.test(row?.id || "") && !used.has(row.id)
              ? row.id
              : makeId();
          used.add(id);
          return {
            id,
            date: text(row?.date),
            title: text(row?.title),
            detail: text(row?.detail),
            body: text(row?.body),
            logo: image(row?.logo),
            level: Math.max(0, Math.min(5, Number(row?.level) || 0)),
          };
        }),
      ];
    }),
  );
}
export const rowText = (rows) =>
  rows
    .map((row) =>
      [row.date, row.title, row.detail, row.body].filter(Boolean).join("\n"),
    )
    .join("\n\n");
export function moveRow(rows, id, direction) {
  const from = rows.findIndex((row) => row.id === id),
    to = from + direction;
  if (from < 0 || to < 0 || to >= rows.length) return rows;
  const result = [...rows];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}
