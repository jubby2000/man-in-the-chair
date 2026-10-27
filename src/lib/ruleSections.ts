// Sub-sections inside rule text. SRD rules are long Markdown documents whose
// useful topics (Grappling, Opportunity Attacks, Critical Hits…) are headings
// INSIDE an entry, not entries of their own. This indexes those headings so
// search can surface "Making an Attack › Grappling" and jump straight to it.

export interface RuleSection {
  ruleId: string;
  ruleName: string;
  heading: string;
  /** DOM anchor shared with the Markdown renderer's heading `data-anchor`. */
  anchor: string;
  /** Enclosing headings within the rule, outermost first (e.g. ["Melee Attacks"]). */
  parents: string[];
}

/** Stable anchor for a heading's text: "Two-Weapon Fighting" -> "two-weapon-fighting". */
export function headingAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const HEADING = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Every heading inside each rule, except the rule's own title heading. */
export function ruleSections(rules: { id: string; name: string; desc?: string }[]): RuleSection[] {
  const out: RuleSection[] = [];
  for (const r of rules) {
    const stack: { level: number; text: string }[] = [];
    const titleKey = r.name.trim().toLowerCase();
    const anchors = anchorCounter();
    for (const line of (r.desc ?? '').split('\n')) {
      const m = line.match(HEADING);
      if (!m) continue;
      const level = m[1].length;
      // count EVERY heading (title included) exactly like the renderer does,
      // so repeated headings get the same "-2", "-3" suffixes on both sides
      const anchor = anchors(m[2]);
      const text = m[2].replace(/[*_`]/g, '').trim();
      // the rule's own title ("## Making an Attack") is the entry, not a section
      if (text.toLowerCase() === titleKey) continue;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      out.push({
        ruleId: r.id,
        ruleName: r.name,
        heading: text,
        anchor,
        parents: stack.map((s) => s.text),
      });
      stack.push({ level, text });
    }
  }
  return out;
}

/**
 * Anchor generator for ONE document: repeated headings (e.g. "Spellcasting
 * Ability" under three abilities) become "spellcasting-ability",
 * "spellcasting-ability-2", … Shared by the index and the Markdown renderer.
 */
export function anchorCounter(): (headingText: string) => string {
  const seen = new Map<string, number>();
  return (headingText) => {
    const base = headingAnchor(headingText);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

/**
 * Scroll the nearest `.panel-body` inside `root` to the heading with this
 * anchor and flash it. Scrolls only the panel (not the page). Returns a
 * cleanup for the highlight timer. No-op if the heading isn't rendered.
 */
export function revealAnchor(root: HTMLElement | null, anchor: string): () => void {
  const el = root?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(anchor)}"]`);
  const scroller = root?.closest<HTMLElement>('.panel-body');
  if (!el || !scroller) return () => {};
  const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
  el.classList.remove('anchor-flash');
  void el.offsetWidth; // restart the animation on repeat jumps
  el.classList.add('anchor-flash');
  const timer = window.setTimeout(() => el.classList.remove('anchor-flash'), 1800);
  return () => window.clearTimeout(timer);
}
