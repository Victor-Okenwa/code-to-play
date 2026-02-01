#!/usr/bin/env node
const esbuild = require("esbuild");
const path = require("path");

const args = process.argv.slice(2);
const watch = args.includes("--watch") || args.includes("-w");

const projectRoot = path.join(__dirname, "..");
const entry = path.join(projectRoot, "src", "extension.ts");
const outfile = path.join(projectRoot, "dist", "extension.js");

async function run() {
  const buildOpts = {
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    outfile,
    sourcemap: true,
    external: ["vscode"],
  };

  if (watch) {
    try {
      const ctx = await esbuild.context(buildOpts);
      await ctx.watch();
      console.log("Watching extension (esbuild context watch)...");
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  } else {
    try {
      await esbuild.build(buildOpts);
      console.log("Extension build complete");
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }
}

run();
