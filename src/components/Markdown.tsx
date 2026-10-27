import { Fragment, type ReactNode } from 'react';
import { RollableText } from './RollableText';

// A small, dependency-free markdown renderer for the SRD rules/conditions
// subset: ATX headings, pipe tables, bullet/numbered lists, blockquotes,
// bold/italic inline, and paragraphs. All plain text flows through RollableText
// so dice expressions stay clickable.

interface Block {
  key: string;
  node: ReactNode;
}

// ---- inline: **bold**, *italic* / _italic_, then dice via RollableText ----
function renderInline(text: string, keyBase: string): ReactNode {
  // Split on bold/italic markers, keeping delimiters.
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
  return tokens.map((tok, i) => {
    const k = `${keyBase}-${i}`;
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return <strong key={k}>{renderInline(tok.slice(2, -2), k)}</strong>;
    }
    if ((tok.startsWith('*') && tok.endsWith('*')) || (tok.startsWith('_') && tok.endsWith('_'))) {
      return <em key={k}>{renderInline(tok.slice(1, -1), k)}</em>;
    }
    return <RollableText key={k}>{tok}</RollableText>;
  });
}

function isTableRow(line: string): boolean {
  return /\|/.test(line);
}
function isDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}
function splitCells(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

export function Markdown({ text, lead }: { text: string; lead?: ReactNode }): ReactNode {
  const lines = (text ?? '').replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  // `lead` (e.g. a bold "Multiattack." label) is rendered inline at the start
  // of the first paragraph; if the text opens with another block, it gets its
  // own paragraph so it's never dropped.
  let leadPending = lead != null;
  const takeLead = (): ReactNode => {
    if (!leadPending) return null;
    leadPending = false;
    return <>{lead} </>;
  };

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      // A single newline is a real line break in this data (SRD spell lists
      // like "At will: …" / "3/day each: …", and FightClub paragraphs), so
      // keep each line rather than soft-joining them with spaces.
      blocks.push({
        key: k,
        node: (
          <p className="md-p">
            {takeLead()}
            {para.map((ln, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(ln, `${k}-${li}`)}
              </Fragment>
            ))}
          </p>
        ),
      });
      para = [];
    }
  };
  const flushLeadAlone = () => {
    if (leadPending) blocks.push({ key: `lead`, node: <p className="md-p">{takeLead()}</p> });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      i++;
      continue;
    }

    // headings
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      flushLeadAlone();
      const level = Math.min(6, h[1].length);
      blocks.push({
        key: `h${blocks.length}`,
        node: (
          <div className={`md-h md-h${level}`} role="heading" aria-level={level}>
            {renderInline(h[2], `h${blocks.length}`)}
          </div>
        ),
      });
      i++;
      continue;
    }

    // tables: a row followed by a divider row. SRD item data separates every
    // table row with a blank line, so blank lines inside a table are skipped.
    const nextNonBlank = (from: number) => {
      let j = from;
      while (j < lines.length && !lines[j].trim()) j++;
      return j;
    };
    const divAt = nextNonBlank(i + 1);
    if (isTableRow(line) && divAt < lines.length && isDivider(lines[divAt])) {
      flushPara();
      flushLeadAlone();
      const header = splitCells(line);
      i = divAt + 1; // skip header + divider
      const rows: string[][] = [];
      for (let j = nextNonBlank(i); j < lines.length && isTableRow(lines[j]); j = nextNonBlank(i)) {
        rows.push(splitCells(lines[j]));
        i = j + 1;
      }
      blocks.push({
        key: `t${blocks.length}`,
        node: (
          <table className="md-table">
            <thead>
              <tr>{header.map((c, ci) => <th key={ci}>{renderInline(c, `th${blocks.length}-${ci}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c, `td${ri}-${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        ),
      });
      continue;
    }

    // lists (bullet or ordered)
    if (/^\s*([*-]|\d+\.)\s+/.test(line)) {
      flushPara();
      flushLeadAlone();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([*-]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([*-]|\d+\.)\s+/, ''));
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push({
        key: `l${blocks.length}`,
        node: (
          <List className="md-list">
            {items.map((it, ii) => (
              <li key={ii}>{renderInline(it, `li${blocks.length}-${ii}`)}</li>
            ))}
          </List>
        ),
      });
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      flushLeadAlone();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({
        key: `q${blocks.length}`,
        node: <blockquote className="md-quote">{renderInline(quote.join(' '), `q${blocks.length}`)}</blockquote>,
      });
      continue;
    }

    // default: accumulate paragraph
    para.push(trimmed);
    i++;
  }
  flushPara();
  flushLeadAlone(); // text was empty

  return (
    <>
      {blocks.map((b) => (
        <Fragment key={b.key}>{b.node}</Fragment>
      ))}
    </>
  );
}
