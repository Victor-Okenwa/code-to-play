/**
 * esbuild.js - ESBuild Configuration with Game Compilation
 * Description: This script configures ESBuild to compile a VSCode extension
 * and multiple games written in TypeScript. It handles copying necessary
 * game files and media assets to the distribution folder.
 */

const esbuild = require("esbuild");
const {
  copyFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} = require("fs");
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar"); // Added for watching static files

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

/**
 * Copy game files and assets to dist folder
 */
function copyGameFiles() {
  console.log("📁 Copying game files...");

  const sourceGamesDir = path.join(__dirname, "src", "games");
  const destGamesDir = path.join(__dirname, "dist", "games");

  if (!existsSync(destGamesDir)) {
    mkdirSync(destGamesDir, { recursive: true });
  }

  const games = readdirSync(sourceGamesDir);

  games.forEach((gameName) => {
    const gamePath = path.join(sourceGamesDir, gameName);

    if (!statSync(gamePath).isDirectory()) {
      return;
    }

    const destGamePath = path.join(destGamesDir, gameName);

    if (!existsSync(destGamePath)) {
      mkdirSync(destGamePath, { recursive: true });
    }

    // Copy HTML, CSS, SVG files
    const files = readdirSync(gamePath);

    files.forEach((file) => {
      const filePath = path.join(gamePath, file);

      if (statSync(filePath).isDirectory() || file.endsWith(".ts")) {
        return;
      }

      if (
        file.endsWith(".html") ||
        file.endsWith(".css") ||
        file.endsWith(".svg")
      ) {
        const destFile = path.join(destGamePath, file);
        copyFileSync(filePath, destFile);
        console.log(`  ✓ Copied ${gameName}/${file}`);
      }
    });

    // Copy assets folder
    const assetsPath = path.join(gamePath, "assets");
    if (existsSync(assetsPath)) {
      const destAssetsPath = path.join(destGamePath, "assets");
      if (!existsSync(destAssetsPath)) {
        mkdirSync(destAssetsPath, { recursive: true });
      }

      const assetFiles = readdirSync(assetsPath);
      assetFiles.forEach((file) => {
        const srcAsset = path.join(assetsPath, file);
        const destAsset = path.join(destAssetsPath, file);

        if (statSync(srcAsset).isFile()) {
          copyFileSync(srcAsset, destAsset);
          console.log(`  ✓ Copied ${gameName}/assets/${file}`);
        }
      });
    }
  });
}

/**
 * Copy media files
 */
function copyMediaFiles() {
  console.log("📁 Copying media files...");

  const sourceMediaDir = path.join(__dirname, "media");
  const destMediaDir = path.join(__dirname, "dist", "media");

  if (!existsSync(sourceMediaDir)) {
    console.log("  ⚠ No media folder found, skipping...");
    return;
  }

  if (!existsSync(destMediaDir)) {
    mkdirSync(destMediaDir, { recursive: true });
  }

  function copyDir(src, dest) {
    const files = readdirSync(src);

    files.forEach((file) => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);

      if (statSync(srcPath).isDirectory()) {
        if (!existsSync(destPath)) {
          mkdirSync(destPath, { recursive: true });
        }
        copyDir(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
        console.log(
          `  ✓ Copied media/${path.relative(sourceMediaDir, srcPath)}`,
        );
      }
    });
  }

  copyDir(sourceMediaDir, destMediaDir);
}

/**
 * Get all game TypeScript files
 */
function getGameEntryPoints() {
  const gamesDir = path.join(__dirname, "src", "games");
  const entryPoints = [];

  if (!existsSync(gamesDir)) {
    return entryPoints;
  }

  const games = readdirSync(gamesDir);

  games.forEach((gameName) => {
    const gamePath = path.join(gamesDir, gameName);

    if (!statSync(gamePath).isDirectory()) {
      return;
    }

    const gameTs = path.join(gamePath, "game.ts");

    if (existsSync(gameTs)) {
      entryPoints.push({
        in: gameTs,
        out: `games/${gameName}/game`,
      });
      console.log(`  Found game: ${gameName}/game.ts`);
    }
  });

  return entryPoints;
}

/**
 * ESBuild plugin to copy files after build
 */
const copyFilesPlugin = {
  name: "copy-files",
  setup(build) {
    build.onEnd(() => {
      copyGameFiles();
      copyMediaFiles();
    });
  },
};

/**
 * Build function
 */
async function build() {
  try {
    console.log("🔍 Finding game entry points...");
    const gameEntryPoints = getGameEntryPoints();

    console.log(`📦 Found ${gameEntryPoints.length} game(s) to compile`);

    // Build extension
    console.log("🔨 Building extension...");
    const extensionOptions = {
      entryPoints: ["src/extension.ts"],
      bundle: true,
      outfile: "dist/extension.js",
      external: ["vscode"],
      format: "cjs",
      platform: "node",
      target: "node16",
      sourcemap: !isProduction,
      minify: isProduction,
      plugins: [copyFilesPlugin],
      logLevel: "info",
    };

    // Build games separately (don't bundle, just compile)
    const gameOptions = gameEntryPoints.map((entry) => ({
      entryPoints: [entry.in],
      bundle: false, // Don't bundle game files
      outfile: `dist/${entry.out}.js`,
      format: "iife", // Immediately Invoked Function Expression
      platform: "browser",
      target: "es2020",
      sourcemap: !isProduction,
      minify: isProduction,
      logLevel: "info",
    }));

    if (isWatch) {
      console.log("👀 Starting watch mode...");

      // Perform initial copies (static files)
      copyGameFiles();
      copyMediaFiles();

      // Set up esbuild watchers for TS files
      const extCtx = await esbuild.context(extensionOptions);
      await extCtx.rebuild(); // Added: Initial build for extension
      await extCtx.watch();

      for (const gameOpts of gameOptions) {
        const gameCtx = await esbuild.context(gameOpts);
        await gameCtx.rebuild(); // Added: Initial build for each game
        await gameCtx.watch();
      }

      // Added: Set up chokidar to watch and copy static files on change
      chokidar
        .watch(
          [
            "src/games/**/*.{html,css,svg}",
            "src/games/**/assets/**",
            "media/**",
          ],
          {
            ignoreInitial: true, // Don't trigger on start (we already copied)
            persistent: true,
          },
        )
        .on("add", handleStaticChange)
        .on("change", handleStaticChange)
        .on("unlink", handleStaticDelete); // Optional: Handle deletes if needed

      function handleStaticChange(filePath) {
        console.log(`📄 Static file changed: ${filePath}`);
        // Determine which copy function to call based on path
        if (filePath.startsWith("src/games")) {
          copyGameFiles();
        } else if (filePath.startsWith("media")) {
          copyMediaFiles();
        }
      }

      function handleStaticDelete(filePath) {
        console.log(`🗑️ Static file deleted: ${filePath}`);
        // Optionally, delete from dist if you want cleanups
        const relativePath = path.relative(__dirname, filePath);
        const destPath = path.join("dist", relativePath.replace(/^src\//, ""));
        if (existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
      }

      console.log(
        "✅ Watching for changes (TS via esbuild, static files via chokidar)...",
      );
    } else {
      console.log("🔨 Building extension...");
      await esbuild.build(extensionOptions);

      console.log("🔨 Building games...");
      for (const gameOpts of gameOptions) {
        await esbuild.build(gameOpts);
      }

      console.log("✅ Build complete!");
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

build();
