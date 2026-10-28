import { PURCHASE_URL } from '../lib/demo';

/** Slim strip above the top bar while the app runs in demo mode. */
export function DemoBanner() {
  return (
    <div className="demo-banner" role="status">
      <span className="demo-badge">Demo</span>
      <span className="demo-text">
        You’re mid-session in a sample campaign. Change anything you like: it all resets when you reload.
      </span>
      <span className="spacer" />
      <button className="btn sm ghost" onClick={() => window.location.reload()} title="Reload the demo from the start">
        Start over
      </button>
      {PURCHASE_URL && (
        <a className="btn sm primary" href={PURCHASE_URL} target="_blank" rel="noopener noreferrer">
          Get the full app
        </a>
      )}
    </div>
  );
}
