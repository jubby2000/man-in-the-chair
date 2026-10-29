import { leaveSampleCampaign } from '../lib/sample';

/** Slim strip above the top bar while the sample campaign is open. */
export function SampleBanner() {
  return (
    <div className="sample-banner" role="status">
      <span className="sample-badge">Sample</span>
      <span className="sample-text">
        You’re looking at a sample session. Change anything you like: it resets when you reload, and your own campaign
        isn’t touched.
      </span>
      <span className="spacer" />
      <button className="btn sm ghost" onClick={() => window.location.reload()} title="Reload the sample from the start">
        Start over
      </button>
      <button className="btn sm primary" onClick={leaveSampleCampaign}>
        Back to my campaign
      </button>
    </div>
  );
}
