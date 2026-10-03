/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Qelvra server, e.g. http://127.0.0.1:3001 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
