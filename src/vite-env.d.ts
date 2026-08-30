/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EQUITY_FEED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
