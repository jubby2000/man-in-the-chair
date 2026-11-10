/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.json' {
  const value: unknown;
  export default value;
}

/** App version from package.json, injected by vite.config `define`. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Donation page shown as "Support" links (see src/lib/support.ts). */
  readonly VITE_SUPPORT_URL?: string;
  /** Public repository shown as "Source code" in Settings. */
  readonly VITE_SOURCE_URL?: string;
  /** "owner/name" GitHub repo that in-app feedback opens issues on. */
  readonly VITE_FEEDBACK_REPO?: string;
}
