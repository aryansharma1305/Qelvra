import { required } from "./automations";
import { acquireDataDirectory } from "../../apps/server/src/release/data-directory-owner.js";
const owner = await acquireDataDirectory(required(process.env.DATA_DIR));
console.log("OWNER_ACQUIRED");
const timer = setInterval(() => {}, 1000);
process.on("SIGTERM", () => {
  clearInterval(timer);
  void owner.release().then(() => process.exit(0));
});
