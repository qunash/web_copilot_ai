import { watch, promises as fs } from "fs";
import { join } from "path";
import { $, Glob } from "bun";
import manifest from "./src/manifest.json";
import { createWriteStream } from "fs";

const srcDir = "./src";
const distDir = "./dist";
const zipFilePath = "./chrome_extension.zip";

// Define file handling configurations
const staticFileExtensions = ['.html', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif'];

// Get entry points from manifest
const getEntryPoints = () => {
    const entryPoints = new Set<string>();

    // Add background service worker
    if (manifest.background?.service_worker) {
        entryPoints.add(join(srcDir, manifest.background.service_worker));
    }

    // Add content scripts from manifest
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

async function processCSS(isProd = false) {
    console.log("Processing CSS...");
    try {
        const postcssArgs = ["postcss", "./src/styles/main.css", "-o", `${distDir}/main.css`];
        if (isProd) {
            postcssArgs.push("--no-map", "--minify");
        }

        const postcssResult = await $`${postcssArgs}`;
        if (postcssResult.exitCode !== 0) {
            throw new Error("CSS processing failed");
        }
        console.log("CSS processed successfully");
    } catch (error) {
        console.error("Error processing CSS:", error);
        throw error;
    }
}

async function buildJavaScript(isProd = false) {
    console.log("Building JavaScript/TypeScript files...");
    try {
        const entrypoints = getEntryPoints();

        // Add content scripts explicitly
        const contentScripts = [
            join(srcDir, 'content-scripts/clickSimulator.ts'),
            join(srcDir, 'content-scripts/pageInteractions.ts')
        ];

        contentScripts.forEach(script => {
            if (!entrypoints.includes(script)) {
                entrypoints.push(script);
            }
        });

        console.log("Building entry points:", entrypoints);

        const result = await Bun.build({
            entrypoints,
            outdir: distDir,
            minify: isProd, // Enable minification for production
            target: 'browser',
        });

        if (!result.success) {
            throw new Error(result.logs.join('\n'));
        }

        // Ensure content-scripts directory exists in dist
        await $`mkdir -p ${join(distDir, 'content-scripts')}`;

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

async function createZip() {
    console.log("Creating ZIP archive...");
    try {
        const zipFilePath = join(distDir, 'chrome_extension.zip');
        await $`zip -r ${zipFilePath} ${distDir}/*`;
        console.log("ZIP archive created successfully");
    } catch (error) {
        console.error("Error creating ZIP archive:", error);
        throw error;
    }
}

async function build(isProd = false) {
    try {
        await cleanDist();
        await Promise.all([
            processCSS(isProd),
            buildJavaScript(isProd),
            copyStaticFiles()
        ]);
        console.log("Build completed successfully!");

        if (isProd) {
            await createZip();
        }
    } catch (error) {
        console.error("Build failed:", error);
        process.exit(1);
    }
}

// Handle different build modes based on arguments
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
} else if (process.argv.includes("--prod")) {
    build(true);
} else {
    build();
}
