#!/usr/bin/env node

const { execSync } = require("node:child_process");

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
}

function isTargetFile(filePath) {
    return [
        "src/app/",
        "src/components/map/",
        "src/components/shop/",
        "src/lib/",
        "src/types/",
    ].some((prefix) => filePath.includes(prefix));
}

function isSupportedFile(filePath) {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
}

function run(cmd) {
    execSync(cmd, { stdio: "pipe" });
}

async function main() {
    const input = await readStdin();
    const filePath = input.tool_input?.file_path || "";

    if (!filePath || !isSupportedFile(filePath) || !isTargetFile(filePath)) {
        process.exit(0);
    }

    const failures = [];

    try {
        run("npm run typecheck");
    } catch (error) {
        failures.push(
            `[typecheck] failed\n${String(error.stdout || error.stderr || error.message)}`
        );
    }

    try {
        run("npm run lint");
    } catch (error) {
        failures.push(
            `[lint] failed\n${String(error.stdout || error.stderr || error.message)}`
        );
    }

    const mapRelated =
        filePath.includes("src/components/map/") ||
        filePath.includes("src/app/page.tsx") ||
        filePath.includes("src/app/mapClient.tsx");

    const shopRelated =
        filePath.includes("src/components/shop/") ||
        filePath.includes("src/app/page.tsx");

    if (mapRelated) {
        try {
            run("npm run test -- map");
        } catch (error) {
            failures.push(
                `[map test] failed\n${String(error.stdout || error.stderr || error.message)}`
            );
        }
    }

    if (shopRelated) {
        try {
            run("npm run test -- shop");
        } catch (error) {
            failures.push(
                `[shop test] failed\n${String(error.stdout || error.stderr || error.message)}`
            );
        }
    }

    if (failures.length > 0) {
        console.error(
            [
                "[hook] Quality gate failed after file edit.",
                `Changed file: ${filePath}`,
                "",
                ...failures,
                "",
                "Fix the issues before continuing.",
            ].join("\n")
        );
        process.exit(2);
    }

    process.exit(0);
}

main().catch((error) => {
    console.error(`[hook] run-quality-gate error: ${error.message}`);
    process.exit(1);
});
