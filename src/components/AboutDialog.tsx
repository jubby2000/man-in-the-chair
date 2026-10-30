import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LICENSE_NAME, SOURCE_URL, SUPPORT_URL } from '../lib/support';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** License, credits and links. Opened from Settings so the menu stays short. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal about-modal"
        role="dialog"
        aria-modal="true"
        aria-label="About Man in the Chair"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>About Man in the Chair</h3>

        <p className="about-text">
          Free and open source under the {LICENSE_NAME} license. No ads, no account, nothing locked. Everything you
          create stays in your browser.
        </p>

        {(SOURCE_URL || SUPPORT_URL) && (
          <div className="settings-data" style={{ marginBottom: 14 }}>
            {SOURCE_URL && (
              <a className="btn sm" href={SOURCE_URL} {...ext}>
                Source code
              </a>
            )}
            {SUPPORT_URL && (
              <a className="btn sm" href={SUPPORT_URL} {...ext}>
                ♥ Support development
              </a>
            )}
          </div>
        )}

        <h4 className="about-heading">Credits</h4>
        <p className="about-text settings-credit">
          This work includes material from the System Reference Documents 5.1 and 5.2 by Wizards of the Coast LLC,
          available at{' '}
          <a href="https://dnd.wizards.com/resources/systems-reference-document" {...ext}>
            dnd.wizards.com
          </a>{' '}
          and{' '}
          <a href="https://www.dndbeyond.com/srd" {...ext}>
            dndbeyond.com/srd
          </a>
          , licensed under the{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" {...ext}>
            Creative Commons Attribution 4.0 International License
          </a>
          . Reformatted for use in this app.
        </p>
        <p className="about-text">
          Unofficial fan content, not affiliated with or endorsed by Wizards of the Coast.
        </p>

        <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn primary" autoFocus onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
