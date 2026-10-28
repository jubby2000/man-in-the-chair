import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Align = 'left' | 'right';

interface PopoverProps {
  /** the trigger element to anchor against */
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  align?: Align;
  /** place above the anchor instead of below */
  placement?: 'bottom' | 'top';
  className?: string;
  children: ReactNode;
}

/**
 * A floating layer rendered in a document.body portal so it is never clipped by
 * a panel's overflow:hidden/auto or by react-grid-layout's transform. Positioned
 * with fixed coordinates computed from the anchor's bounding rect, and kept in
 * place on scroll/resize. Closes on outside-click and Escape.
 */
export function Popover({
  anchorRef,
  open,
  onClose,
  align = 'left',
  placement = 'bottom',
  className,
  children,
}: PopoverProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; maxHeight?: number } | null>(null);
  const measured = useRef(false);

  // Position against the anchor. For bottom placement, flip above the anchor
  // when the popover doesn't fit below and there's more room above, and cap its
  // height (scrolling inside) so no option is ever pushed off-screen.
  const place = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const h = popRef.current?.scrollHeight ?? 0;
    let top: number;
    let maxHeight: number | undefined;
    if (placement === 'top') {
      top = r.top;
    } else {
      const below = window.innerHeight - r.bottom - gap - margin;
      const above = r.top - gap - margin;
      if (h > below && above > below) {
        maxHeight = above;
        top = Math.max(margin, r.top - gap - Math.min(h, above));
      } else {
        maxHeight = below;
        top = r.bottom + gap;
      }
    }
    if (align === 'right') {
      setPos({ top, right: Math.max(margin, window.innerWidth - r.right), maxHeight });
    } else {
      setPos({ top, left: Math.max(margin, r.left), maxHeight });
    }
  }, [anchorRef, align, placement]);

  useLayoutEffect(() => {
    if (!open) return;
    measured.current = false;
    place();
    window.addEventListener('scroll', place, true); // capture: catch scroll in any ancestor
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  // The first placement happens before the popover exists, so its height is
  // unknown; re-place once it has rendered and can be measured.
  useLayoutEffect(() => {
    if (open && pos && popRef.current && !measured.current) {
      measured.current = true;
      place();
    }
  }, [open, pos, place]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      // a nested popover (e.g. a Dropdown opened inside this one) is its own
      // portal layer; pressing inside it must not close this one
      if (t instanceof Element && t.closest('.popover-layer')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={popRef}
      className={`popover-layer ${className ?? ''}`}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        right: pos.right,
        maxHeight: pos.maxHeight,
        overflowY: pos.maxHeight !== undefined ? 'auto' : undefined,
        transform: placement === 'top' ? 'translateY(-100%)' : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
