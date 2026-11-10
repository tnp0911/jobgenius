"use client";

import "./optimizer-suggestions.css";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

const DEFAULT_SECTION_ORDER = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "other",
];

function sectionTitle(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function orderedSectionEntries(
  sections: Record<string, unknown>,
  order: string[],
): { key: string; title: string; text: string }[] {
  const used = new Set<string>();
  const entries: { key: string; title: string; text: string }[] = [];
  const keys = [...order, ...DEFAULT_SECTION_ORDER, ...Object.keys(sections)];

  for (const rawKey of keys) {
    const key = rawKey.trim().toLowerCase();
    if (!key || used.has(key)) continue;
    used.add(key);
    const text = asString(sections[key] ?? sections[rawKey]).trim();
    if (!text) continue;
    entries.push({ key, title: sectionTitle(key), text });
  }
  return entries;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string): string {
  const escaped = escapeRegExp(term);
  if (/^[A-Za-z0-9]/.test(term) && /[A-Za-z0-9]$/.test(term)) {
    return `\\b${escaped}\\b`;
  }
  return escaped;
}

type HighlightKind = "keyword" | "change";

function highlightTerms(
  keywords: string[],
  changes: string[],
): { term: string; kind: HighlightKind }[] {
  const terms: { term: string; kind: HighlightKind }[] = [];
  for (const keyword of keywords) {
    const term = keyword.trim();
    if (term) terms.push({ term, kind: "keyword" });
  }
  for (const change of changes) {
    const term = change.trim();
    if (term) terms.push({ term, kind: "change" });
  }
  return terms.sort((a, b) => b.term.length - a.term.length);
}

function HighlightedText({
  text,
  terms,
}: {
  text: string;
  terms: { term: string; kind: HighlightKind }[];
}) {
  if (!text) return null;
  const usable = terms.filter((item) => item.term.length > 0);
  if (usable.length === 0) {
    return <p className="optimizer-suggestions-prose">{text}</p>;
  }

  let matcher: RegExp;
  try {
    matcher = new RegExp(
      `(${usable.map((item) => termPattern(item.term)).join("|")})`,
      "gi",
    );
  } catch {
    return <p className="optimizer-suggestions-prose">{text}</p>;
  }
  const kindByLower = new Map(
    usable.map((item) => [item.term.toLowerCase(), item.kind]),
  );
  const parts = text.split(matcher);

  return (
    <p className="optimizer-suggestions-prose">
      {parts.map((part, index) => {
        const kind = kindByLower.get(part.toLowerCase());
        if (!kind) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }
        return (
          <mark
            key={`${part}-${index}`}
            className={
              kind === "keyword"
                ? "optimizer-highlight optimizer-highlight-keyword"
                : "optimizer-highlight optimizer-highlight-change"
            }
          >
            {part}
          </mark>
        );
      })}
    </p>
  );
}

export function OptimizerSuggestions({
  optimizer,
}: {
  optimizer: unknown;
}) {
  const record = asRecord(optimizer);
  const sections = asRecord(record.optimized_sections);
  const order = asStringList(record.section_order);
  const keywordsRaw = asStringList(record.keywords_integrated);
  // Convert keywords to set for unique keywords
  const keywordsSet = new Set(keywordsRaw);
  const keywords = Array.from(keywordsSet) as string[];
  const changes = asStringList(record.changes_made);
  const entries = orderedSectionEntries(sections, order);
  const notes = asString(record.optimization_notes).trim();
  const terms = highlightTerms(keywords, changes);

  if (
    entries.length === 0 &&
    keywords.length === 0 &&
    changes.length === 0 &&
    !notes
  ) {
    return null;
  }

  return (
    <section className="optimizer-suggestions" aria-labelledby="optimizer-suggestions-title">
      <h3 id="optimizer-suggestions-title" className="optimizer-suggestions-title">
        Optimizer suggestions
      </h3>
      {keywords.length > 0 ? (
        <div className="optimizer-suggestions-legend">
          <p className="optimizer-suggestions-legend-label">Keywords integrated</p>
          <ul className="optimizer-tag-list">
            {keywords.map((item) => (
              
              <li key={item} className="optimizer-tag">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {changes.length > 0 ? (
        <div className="optimizer-suggestions-legend">
          <p className="optimizer-suggestions-legend-label">Changes made</p>
          <ul className="optimizer-suggestions-list">
            {changes.map((change) => (
              <li key={change}>
                <mark className="optimizer-highlight optimizer-highlight-change">
                  {change}
                </mark>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {entries.map((entry) => (
        <section key={entry.key} className="optimizer-suggestions-section">
          <h4 className="optimizer-suggestions-section-title">{entry.title}</h4>
          <HighlightedText text={entry.text} terms={terms} />
        </section>
      ))}
      {notes ? <p className="optimizer-suggestions-notes">{notes}</p> : null}
    </section>
  );
}
