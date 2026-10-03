import { resolve } from "node:path";

// Browser tests run their own server and web app on separate ports with a fresh data
// directory, so they never touch (or reuse) the developer's running `npm run dev`.
export const E2E_WEB_PORT = 5174;
export const E2E_API_PORT = 3101;
export const E2E_WEB_URL = `http://127.0.0.1:${E2E_WEB_PORT}`;
export const E2E_API_URL = `http://127.0.0.1:${E2E_API_PORT}`;
export const E2E_DATA_DIR = resolve(".qelvra-e2e");
