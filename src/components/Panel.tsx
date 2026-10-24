import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  tools?: ReactNode;
  flush?: boolean;
  onClose?: () => void;
}

/** Panel chrome. The header is the react-grid-layout drag handle. */
export function Panel({ title, children, tools, flush, onClose }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-header drag-handle">
        <span className="panel-title">{title}</span>
        <div className="tools">
          {tools}
          {onClose && (
            <button
              className="btn icon sm ghost panel-close-btn"
              title="Remove panel"
              // keep pointerDown from starting a drag on the handle
              onMouseDown={(e) => e.stopPropagation()}
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
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </div>
  );
}
