import { watch } from "fs";
import { join } from "path";

const srcDir = "./src";
const distDir = "./dist";

// Copy static files function - optimized with Bun's native file APIs
async function copyStaticFiles() {
  console.log("Copying static files...");
  try {
    // Bun.write() automatically creates parent directories since v1.0.16
    await Bun.write(
      join(distDir, "manifest.json"),
      await Bun.file(join(srcDir, "manifest.json")).text()
    );
    
    await Bun.write(
      join(distDir, "sidepanel.html"),
      await Bun.file(join(srcDir, "sidepanel.html")).text()
    );
    
    console.log("Static files copied successfully");
  } catch (error) {
    console.error("Error copying static files:", error);
  }
}

// Build function with enhanced Bun.build configuration
async function build() {
  console.log("Building...");
  
  try {
    const result = await Bun.build({
      entrypoints: [
        './src/index.ts',
        './src/service_worker.ts',
      ],
      outdir: './dist',
      target: 'browser',
      minify: {
        whitespace: true,
        syntax: true,
        identifiers: true
      },
      sourcemap: 'external', // Generate source maps for debugging
      splitting: true, // Enable code splitting for better caching
    });

    if (!result.success) {
      console.error("Build failed:", result.logs);
      return;
    }

    await copyStaticFiles();
    console.log("Build completed successfully");
  } catch (error) {
    console.error("Build failed:", error);
  }
}

// Initial build
await build();

// Watch mode with optimized file handling
if (process.argv.includes("--watch")) {
  console.log("Watching for changes...");
  
  watch(srcDir, { recursive: true }, async (eventType, filename) => {
    if (!filename) return;
    
    console.log(`File ${filename} changed`);
    
    try {
      // Only rebuild what's necessary
      if (filename.endsWith('.html') || filename.endsWith('.json')) {
        await copyStaticFiles();
      } else if (filename.endsWith('.ts') || filename.endsWith('.js')) {
        await build();
      }
    } catch (error) {
      console.error("Error processing file change:", error);
    }
  });
}