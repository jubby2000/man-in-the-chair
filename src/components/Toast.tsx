import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={`toast ${visible ? 'show' : ''}`} key={toast.id}>
      {toast.message}
    </div>
  );
}
