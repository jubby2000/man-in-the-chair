/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.json' {
  const value: unknown;
  export default value;
}

/** App version from package.json, injected by vite.config `define`. */
declare const __APP_VERSION__: string;
