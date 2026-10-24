import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  tools?: ReactNode;
  flush?: boolean;
}

/** Panel chrome. The header is the react-grid-layout drag handle. */
export function Panel({ title, children, tools, flush }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-header drag-handle">
        <span className="panel-title">{title}</span>
        {tools && <div className="tools">{tools}</div>}
      </div>
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </div>
  );
}
