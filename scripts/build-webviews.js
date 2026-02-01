#!/usr/bin/env node
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const watch = args.includes("--watch") || args.includes("-w");

const projectRoot = path.join(__dirname, "..");
const srcGamesDir = path.join(projectRoot, "src", "games");
const distGamesDir = path.join(projectRoot, "dist", "games");

if (!fs.existsSync(distGamesDir)) {
  fs.mkdirSync(distGamesDir, { recursive: true });
}

const games = fs
  .readdirSync(srcGamesDir)
  .filter((name) => fs.statSync(path.join(srcGamesDir, name)).isDirectory());

async function run() {
  const contexts = [];
  const buildPromises = [];

  for (const gameId of games) {
    const entry = path.join(srcGamesDir, gameId, "game.ts");
    if (!fs.existsSync(entry)) {
      console.log(`Skipping ${gameId}: no game.ts`);
      continue;
    }

    const outDir = path.join(distGamesDir, gameId);
    fs.mkdirSync(outDir, { recursive: true });
    const outfile = path.join(outDir, "game.js");

    const buildOpts = {
      entryPoints: [entry],
      bundle: true,
      platform: "browser",
      format: "iife",
      globalName: `Game_${gameId.replace(/[-\s]/g, "_")}`,
      outfile,
      sourcemap: true,
      minify: false,
    };

    if (watch) {
      try {
        const ctx = await esbuild.context(buildOpts);
        // Start watching; do not await to allow other builds to start
        ctx.watch().then(() => console.log(`${gameId} watch ended`));
        contexts.push(ctx);
        console.log(`${gameId} watching`);
      } catch (err) {
        console.error(`${gameId} watch failed:`, err);
        process.exit(1);
      }
    } else {
      buildPromises.push(
        esbuild.build(buildOpts).then(() => console.log(`${gameId} built`)),
      );
    }
  }

  if (!watch) {
    Promise.all(buildPromises)
      .then(() => {
        console.log("Webviews build complete");
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    console.log("Watching webviews (esbuild context watch)...");
  }
}

run();
