import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const gap = 6;
      const top = placement === 'top' ? r.top : r.bottom + gap;
      if (align === 'right') {
        setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
      } else {
        setPos({ top, left: Math.max(8, r.left) });
      }
    };
    place();
    window.addEventListener('scroll', place, true); // capture: catch scroll in any ancestor
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align, placement, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
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
        transform: placement === 'top' ? 'translateY(-100%)' : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
