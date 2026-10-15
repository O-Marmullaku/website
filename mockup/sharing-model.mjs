export const companyDirectory = [
  { name: "Siemens", domain: "siemens.com" },
  { name: "ABB", domain: "abb.com" },
  { name: "Swisscom", domain: "swisscom.ch" },
  { name: "Roche", domain: "roche.com" },
  { name: "Novartis", domain: "novartis.com" },
  { name: "Google", domain: "google.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "ETH Zürich", domain: "ethz.ch" },
];
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]/g, "");
function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    previous = current;
  }
  return previous[b.length];
}
export function findCompanies(query, recent = []) {
  const needle = normalize(String(query).slice(0, 120));
  const unique = new Map();
  for (const company of [...recent, ...companyDirectory]) {
    if (!company || typeof company.name !== "string") continue;
    const key = normalize(company.name);
    if (!unique.has(key))
      unique.set(key, {
        name: company.name.slice(0, 120),
        domain:
          typeof company.domain === "string"
            ? company.domain.slice(0, 120)
            : "",
      });
  }
  return [...unique.values()]
    .map((company, index) => {
      const words = [company.name, company.domain, ...company.name.split(/\s+/)]
        .map(normalize)
        .filter(Boolean);
      let score = needle ? Infinity : index;
      for (const word of words) {
        if (word === needle) score = Math.min(score, 0);
        else if (word.startsWith(needle)) score = Math.min(score, 1);
        else if (word.includes(needle)) score = Math.min(score, 2);
        else if (needle.length >= 3) {
          const diff = distance(needle, word);
          if (diff <= Math.max(1, Math.floor(needle.length / 4)))
            score = Math.min(score, 3 + diff / word.length);
        }
      }
      return { company, score, index };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, 6)
    .map((item) => item.company);
}
export const companySections = [
  "contact",
  "profile",
  "education",
  "experience",
  "skills",
  "languages",
  "certificates",
  "interests",
  "documents",
  "extras",
];
// Each CV owner grants access. A link sender cannot grant it on their behalf.
export const visibleProfiles = (profiles, senderId) =>
  profiles.filter(
    (profile) =>
      profile.id === senderId || profile.shareWith?.includes(senderId),
  );
export function summarizeActivity(events) {
  const opens = events.filter((event) => event.type === "visit");
  return {
    opens: opens.length,
    lastOpened: opens.at(-1)?.at || null,
    clicks: events.filter((event) => event.type !== "visit").length,
  };
}
