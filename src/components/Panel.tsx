import { useEffect, useRef, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  tools?: ReactNode;
  flush?: boolean;
  onClose?: () => void;
  /** When this value changes, the panel body scrolls back to the top. */
  scrollResetKey?: string | number | null;
}

/** Panel chrome. The header is the react-grid-layout drag handle. */
export function Panel({ title, children, tools, flush, onClose, scrollResetKey }: PanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [scrollResetKey]);

  return (
    <div className="panel">
      <div className="panel-header drag-handle">
        <span className="panel-title">{title}</span>
        <div
          className="tools"
          // The header is the drag handle; without this, a press on a tool
          // button starts a panel drag and the click never fires. Stop both
          // pointer kinds: mouse (desktop) and touch (tablet/phone), where the
          // grid starts dragging on touchstart rather than mousedown.
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {tools}
          {onClose && (
            <button
              className="btn icon sm ghost panel-close-btn"
              title="Remove panel"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div ref={bodyRef} className={flush ? 'panel-body flush' : 'panel-body'}>
        {children}
      </div>
    </div>
  );
}
