import type { ReactNode } from "react";

/** Fix common UTF-8 mojibake from LLM / transport (e.g. â → ’). */
export function repairAgentText(text: string): string {
  return text
    .replace(/â€™/g, "’")
    .replace(/â€˜/g, "‘")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¦/g, "…")
    .replace(/\u0000/g, "");
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let part = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong key={`${keyPrefix}-b-${part++}`}>{match[1]}</strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

type ListItem = {
  text: string;
  children: string[];
};

/**
 * Render agent markdown-ish replies:
 * headings (###), bullets (-), nested bullets (indented -), **bold**, paragraphs.
 */
export function renderAgentMarkdown(raw: string): ReactNode {
  const text = repairAgentText(raw).replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: ListItem[] = [];
  let blockKey = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const content = paragraph.join(" ").trim();
    paragraph = [];
    if (!content) return;
    const key = `p-${blockKey++}`;
    blocks.push(
      <p key={key} className="agent-md-p">
        {renderInlineMarkdown(content, key)}
      </p>,
    );
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    const key = `ul-${blockKey++}`;
    blocks.push(
      <ul key={key} className="agent-md-list">
        {items.map((item, i) => (
          <li key={`${key}-${i}`} className="agent-md-li">
            <div className="agent-md-li-main">
              {renderInlineMarkdown(item.text, `${key}-${i}`)}
            </div>
            {item.children.length > 0 ? (
              <ul className="agent-md-list agent-md-list-nested">
                {item.children.map((child, j) => (
                  <li key={`${key}-${i}-c-${j}`} className="agent-md-li">
                    {renderInlineMarkdown(child, `${key}-${i}-c-${j}`)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>,
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const key = `h-${blockKey++}`;
      const className = `agent-md-h agent-md-h${level}`;
      const children = renderInlineMarkdown(heading[2], key);
      blocks.push(
        level <= 2 ? (
          <h3 key={key} className={className}>
            {children}
          </h3>
        ) : (
          <h4 key={key} className={className}>
            {children}
          </h4>
        ),
      );
      continue;
    }

    const nestedBullet = line.match(/^\s{2,}[-*]\s+(.+)$/);
    if (nestedBullet && listItems.length > 0) {
      listItems[listItems.length - 1].children.push(nestedBullet[1].trim());
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      listItems.push({ text: bullet[1].trim(), children: [] });
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="agent-md">{blocks}</div>;
}
