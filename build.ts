import { watch, promises as fs } from "fs";
import { join } from "path";
import { $, Glob } from "bun";
import manifest from "./src/manifest.json";

const srcDir = "./src";
const distDir = "./dist";

// Define file handling configurations
const staticFileExtensions = ['.html', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif'];

// Get entry points from manifest
const getEntryPoints = () => {
    const entryPoints = new Set<string>();

    // Add background service worker
    if (manifest.background?.service_worker) {
        entryPoints.add(join(srcDir, manifest.background.service_worker));
    }

    // Add content scripts
    manifest.content_scripts?.forEach(script => {
        script.js?.forEach(js => {
            entryPoints.add(join(srcDir, js));
        });
    });

    // Add sidepanel script (extracted from the HTML file)
    if (manifest.side_panel?.default_path) {
        entryPoints.add(join(srcDir, 'index.tsx'));
    }

    return Array.from(entryPoints);
};

async function cleanDist() {
    console.log("Cleaning dist directory...");
    await $`rm -rf ${distDir}`;
    await $`mkdir -p ${distDir}`;
}

async function processCSS() {
    console.log("Processing CSS...");
    try {
        const postcssResult = await $`postcss ./src/styles/main.css -o ${distDir}/main.css`;
        if (postcssResult.exitCode !== 0) {
            throw new Error("CSS processing failed");
        }
        console.log("CSS processed successfully");
    } catch (error) {
        console.error("Error processing CSS:", error);
        throw error;
    }
}

async function buildJavaScript() {
    console.log("Building JavaScript/TypeScript files...");
    try {
        const entrypoints = getEntryPoints();
        console.log("Building entry points:", entrypoints);

        const result = await Bun.build({
            entrypoints,
            outdir: distDir,
            minify: false,
            target: 'browser',
        });

        if (!result.success) {
            throw new Error(result.logs.join('\n'));
        }
        console.log("JavaScript built successfully");
    } catch (error) {
        console.error("Error building JavaScript:", error);
        throw error;
    }
}

async function copyStaticFiles() {
    console.log("Copying static files...");
    try {
        const glob = new Glob("**/*");

        // Copy all static files maintaining directory structure
        for await (const file of glob.scan(srcDir)) {
            const ext = file.slice(file.lastIndexOf('.'));
            // Skip CSS files and TypeScript/JavaScript files as they are handled separately
            if (file.includes('styles/main.css')) continue;
            if (file.endsWith('.ts') || file.endsWith('.js')) continue;
            
            if (staticFileExtensions.includes(ext)) {
                const srcPath = join(srcDir, file);
                const destPath = join(distDir, file);
                await $`mkdir -p ${destPath.substring(0, destPath.lastIndexOf('/'))}`;
                await $`cp ${srcPath} ${destPath}`;
            }
        }

        // Copy manifest.json
        const manifestSrc = join(srcDir, 'manifest.json');
        const manifestDest = join(distDir, 'manifest.json');
        await $`cp ${manifestSrc} ${manifestDest}`;

        // Copy icons directory if it exists
        if (await fs.access(join(srcDir, 'icons')).then(() => true).catch(() => false)) {
            await $`cp -R ${join(srcDir, 'icons')} ${distDir}`;
        }

        console.log("Static files copied successfully");
    } catch (error) {
        console.error("Error copying static files:", error);
        throw error;
    }
}

async function build() {
    try {
        await cleanDist();
        await Promise.all([
            processCSS(),
            buildJavaScript(),
            copyStaticFiles()
        ]);
        console.log("Build completed successfully!");
    } catch (error) {
        console.error("Build failed:", error);
        process.exit(1);
    }
}

// Handle watch mode
if (process.argv.includes("--watch")) {
    build().then(() => {
        console.log("Watching for changes...");
        
        // Watch the src directory
        watch(srcDir, { recursive: true }, async (event, filename) => {
            if (!filename) return;
            
            console.log(`File ${filename} changed. Rebuilding...`);
            await build();
        });
    });
} else {
    build();
}