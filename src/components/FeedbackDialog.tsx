import { useEffect, useMemo, useState } from 'react';
import { Dropdown } from './Dropdown';
import { useStore } from '../store/useStore';
import { PANEL_TITLES } from '../store/presets';
import { SUPPORT_URL } from '../lib/support';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_EMAIL,
  FEEDBACK_KINDS,
  FEEDBACK_REPO,
  ISSUE_URL_SAFE_LENGTH,
  MAILTO_SAFE_LENGTH,
  buildFeedback,
  detailsText,
  githubIssueUrl,
  mailtoUrl,
  type FeedbackContext,
  type FeedbackKind,
} from '../lib/feedback';

const RULESET_LABEL: Record<string, string> = { srd51: 'SRD 5.1 (2014)', srd52: 'SRD 5.2 (2024)' };

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const edition = useStore((s) => s.edition);
  const presets = useStore((s) => s.presets);
  const activePresetId = useStore((s) => s.activePresetId);
  const showToast = useStore((s) => s.showToast);

  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [category, setCategory] = useState('');
  const [sub, setSub] = useState('');
  const [message, setMessage] = useState('');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const cat = FEEDBACK_CATEGORIES.find((c) => c.value === category);

  // Only non-identifying technical info; never compendium/party/notes content.
  const context: FeedbackContext = useMemo(() => {
    const active = presets.find((p) => p.id === activePresetId) ?? presets[0];
    return {
      appVersion: __APP_VERSION__,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}×${window.innerHeight}`,
      ruleset: RULESET_LABEL[edition] ?? edition,
      openPanels: (active?.items ?? []).map((it) => PANEL_TITLES[it.panel] ?? it.panel),
    };
  }, [edition, presets, activePresetId]);

  const ready = category !== '' && (!cat?.sub || sub !== '') && message.trim().length > 0;
  const { subject, body } = buildFeedback({ kind, category, sub, message, includeDetails }, context);
  const mailto = FEEDBACK_EMAIL ? mailtoUrl(FEEDBACK_EMAIL, subject, body) : '';
  const tooLongForMail = mailto.length > MAILTO_SAFE_LENGTH;
  const issueUrl = FEEDBACK_REPO
    ? githubIssueUrl(FEEDBACK_REPO, { kind, category, sub, message, includeDetails }, context)
    : '';
  const tooLongForGithub = issueUrl.length > ISSUE_URL_SAFE_LENGTH;
  const canGithub = ready && !!issueUrl && !tooLongForGithub;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      showToast('Feedback copied to clipboard');
    } catch {
      showToast('Couldn’t access the clipboard');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="feedback-title">Send feedback</h3>

        <div className="field">
          <label>What kind of feedback?</label>
          <div className="feedback-kinds" role="radiogroup">
            {FEEDBACK_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                className={`btn sm ${kind === k.value ? 'primary' : ''}`}
                onClick={() => setKind(k.value)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>What’s it about?</label>
          <Dropdown<string>
            value={category}
            placeholder="Choose a topic"
            onChange={(v) => {
              setCategory(v);
              setSub(''); // follow-up options differ per topic
            }}
            options={FEEDBACK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>

        {cat?.sub && (
          <div className="field">
            <label>{cat.sub.label}</label>
            <Dropdown<string>
              value={sub}
              placeholder="Choose one"
              onChange={setSub}
              options={cat.sub.options}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="feedback-message">
            {kind === 'bug' ? 'What happened, and what did you expect?' : 'Tell us more'}
          </label>
          <textarea
            id="feedback-message"
            className="input feedback-text"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              kind === 'bug'
                ? 'e.g. I rolled loot with 3 items and only got coins.'
                : 'e.g. It would help if the timer could…'
            }
          />
        </div>

        <div className="field feedback-details">
          <label className="feedback-check">
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
            />
            Include technical details
          </label>
          <button type="button" className="btn ghost sm" onClick={() => setShowDetails((s) => !s)}>
            {showDetails ? 'Hide' : 'What’s included?'}
          </button>
          {showDetails && <pre className="feedback-preview">{detailsText(context)}</pre>}
          <div className="settings-hint">
            Never includes your compendium, party, notes or other campaign data.
          </div>
        </div>

        {FEEDBACK_REPO && (
          <div className="settings-hint">
            {tooLongForGithub && ready
              ? 'This is too long to open on GitHub in one go — shorten it, or use Copy and paste it into a new issue.'
              : 'Opens a filled-in issue on GitHub in a new tab. You’ll need a GitHub account; review it there and press Submit.'}
          </div>
        )}

        {FEEDBACK_EMAIL && tooLongForMail && ready && (
          <div className="settings-hint">
            This is long enough that some email apps may cut it off — use Copy and paste it into
            an email instead.
          </div>
        )}

        <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          {SUPPORT_URL && (
            <a className="feedback-support" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              ♥ Enjoying it? Support development
            </a>
          )}
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={!ready} onClick={() => void copy()}>
            Copy
          </button>
          {FEEDBACK_EMAIL && (
            <a
              className={`btn primary ${ready ? '' : 'disabled'}`}
              href={ready ? mailto : undefined}
              aria-disabled={!ready}
              onClick={(e) => {
                if (!ready) e.preventDefault();
                else onClose();
              }}
            >
              Open in email
            </a>
          )}
          {FEEDBACK_REPO && (
            <a
              className={`btn primary ${canGithub ? '' : 'disabled'}`}
              href={canGithub ? issueUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!canGithub}
              onClick={(e) => {
                if (!canGithub) e.preventDefault();
                else onClose();
              }}
            >
              Open GitHub issue
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
