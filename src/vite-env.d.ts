/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_AGENTMAIL_FORWARDING_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
