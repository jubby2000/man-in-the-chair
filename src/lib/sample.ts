// Sample campaign: a pre-populated, throwaway session people can open to see
// the app in use. It runs in its OWN IndexedDB database (never the user's real
// one) and is wiped and reseeded on every load.
//
// Opened with `?sample` (Settings → "Try the sample campaign", or the welcome
// card on a fresh install). Leaving drops the param and reloads into the
// user's own data.
//
// The sample ships in the public build, so it holds only SRD (CC-BY) content
// and original seed data — nothing that isn't ours to share.
//
// No imports here: db.ts depends on this module.

export const IS_SAMPLE: boolean =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('sample');

// Kept from the old demo mode so existing installs don't end up with an
// orphaned database; it's cleared on every sample load anyway.
export const SAMPLE_DB_NAME = 'man-in-the-chair-demo';

/** Import / backup / restore would write into a database that's wiped on reload. */
export const SAMPLE_BLOCKED_MESSAGE = 'Not available in the sample campaign. Go back to your campaign first.';

function urlWithSample(on: boolean): string {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set('sample', '');
  else url.searchParams.delete('sample');
  // `?sample=` → `?sample` for a tidier address bar
  return url.toString().replace(/([?&]sample)=(?=&|#|$)/, '$1');
}

export function openSampleCampaign(): void {
  window.location.assign(urlWithSample(true));
}

export function leaveSampleCampaign(): void {
  window.location.assign(urlWithSample(false));
}
