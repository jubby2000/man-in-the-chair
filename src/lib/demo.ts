// Demo mode: a pre-populated, throwaway copy of the app for people to try
// before buying. It runs in its OWN IndexedDB database (never the real one),
// is wiped and reseeded on every load, and has every export path switched off.
//
// Two ways in:
//   - a demo build (`npm run build:demo`, sets VITE_DEMO=1): always demo. This
//     is the build to host publicly.
//   - `?demo` on any build, handy for trying it locally.
//
// "Export off" stops casual exporting; it can't stop someone with devtools
// copying data out of their own browser. That's why the demo holds only SRD
// (CC-BY) content and original seed data — nothing that isn't ours to share.
//
// No imports here: db.ts depends on this module.

export const IS_DEMO: boolean =
  import.meta.env.VITE_DEMO === '1' ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo'));

export const DEMO_DB_NAME = 'man-in-the-chair-demo';

/** Where the banner's "Get the full app" button points. Empty = button hidden. */
export const PURCHASE_URL = '';

export const DEMO_BLOCKED_MESSAGE = 'Not available in the demo';
