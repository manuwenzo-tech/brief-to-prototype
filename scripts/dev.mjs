import { spawn } from "node:child_process";

const args = process.argv.slice(2);
if (!args.includes("--port")) args.push("--port", "3000");
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...args], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => { process.exitCode = code ?? 0; });
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
