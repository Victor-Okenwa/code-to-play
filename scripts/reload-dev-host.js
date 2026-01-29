import chokidar from "chokidar";
import { exec } from "node:child_process";

const WATCH_DIR = "dist"; // or "out"

console.log("👀 Watching extension output for changes...");

chokidar.watch(WATCH_DIR, { ignoreInitial: true }).on("all", () => {
  console.log("♻️  Reloading Extension Host...");
  exec("code --command workbench.action.reloadWindow", { shell: true });
});
