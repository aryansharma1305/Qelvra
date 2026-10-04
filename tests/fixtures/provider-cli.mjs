import process from "node:process";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
const status = () =>
  process.stdout.write(
    `${JSON.stringify({ marker: "PROVIDER_FIXTURE_READY", cwd: process.cwd(), childPid: child.pid, secretPresent: Boolean(process.env.UNRELATED_SECRET), loaderPresent: Boolean(process.env.NODE_OPTIONS) })}\n> `,
  );
status();
createInterface({ input: process.stdin }).on("line", (line) => {
  if (line === "STATUS") status();
  else process.stdout.write(`ECHO ${line}\n> `);
});
