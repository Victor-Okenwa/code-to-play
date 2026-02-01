/**
 * esbuild.js - ESBuild Configuration
 *
 * Fast bundler for VS Code extension development
 * Much faster than webpack!
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

// Check if we're in watch mode
const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

/**
 * Copy game files and assets to dist folder
 */
function copyGameFiles() {
  console.log("📁 Copying game files...");

  const sourceGamesDir = path.join(__dirname, "src", "games");
  const destGamesDir = path.join(__dirname, "dist", "games");

  // Create dist/games if it doesn't exist
  if (!existsSync(destGamesDir)) {
    mkdirSync(destGamesDir, { recursive: true });
  }

  // Copy each game folder
  const games = readdirSync(sourceGamesDir);

  games.forEach((gameName) => {
    const gamePath = path.join(sourceGamesDir, gameName);

    // Skip if not a directory
    if (!statSync(gamePath).isDirectory()) {
      return;
    }

    const destGamePath = path.join(destGamesDir, gameName);

    // Create game directory
    if (!existsSync(destGamePath)) {
      mkdirSync(destGamePath, { recursive: true });
    }

    // Copy HTML, CSS, SVG files
    const files = readdirSync(gamePath);

    files.forEach((file) => {
      const filePath = path.join(gamePath, file);

      // Skip directories and TypeScript files
      if (statSync(filePath).isDirectory() || file.endsWith(".ts")) {
        return;
      }

      // Copy HTML, CSS, SVG files
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

    // Copy assets folder if exists
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
 * Copy media files (fonts, icons, etc.)
 */
function copyMediaFiles() {
  console.log("📁 Copying media files...");

  const sourceMediaDir = path.join(__dirname, "media");
  const destMediaDir = path.join(__dirname, "dist", "media");

  if (!existsSync(sourceMediaDir)) {
    console.log("  ⚠ No media folder found, skipping...");
    return;
  }

  // Create dist/media if it doesn't exist
  if (!existsSync(destMediaDir)) {
    mkdirSync(destMediaDir, { recursive: true });
  }

  // Recursively copy media files
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
 * ESBuild configuration
 */
const buildOptions = {
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

/**
 * Build function
 */
async function build() {
  try {
    if (isWatch) {
      // Watch mode
      console.log("👀 Starting watch mode...");
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("✅ Watching for changes...");
    } else {
      // Single build
      console.log("🔨 Building extension...");
      await esbuild.build(buildOptions);
      console.log("✅ Build complete!");
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

// Run build
build();
