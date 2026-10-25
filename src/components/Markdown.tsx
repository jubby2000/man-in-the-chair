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

export function Markdown({ text }: { text: string }): ReactNode {
  const lines = (text ?? '').replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const joined = para.join(' ');
      blocks.push({ key: `p${blocks.length}`, node: <p className="md-p">{renderInline(joined, `p${blocks.length}`)}</p> });
      para = [];
    }
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

    // tables: a row followed by a divider row
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushPara();
      const header = splitCells(line);
      i += 2; // skip header + divider
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && lines[i].trim()) {
        rows.push(splitCells(lines[i]));
        i++;
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

  return (
    <>
      {blocks.map((b) => (
        <Fragment key={b.key}>{b.node}</Fragment>
      ))}
    </>
  );
}
