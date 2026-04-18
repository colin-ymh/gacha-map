#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

function isInterestingFile(filePath) {
  return (
    filePath.endsWith(".ts") ||
    filePath.endsWith(".tsx") ||
    filePath.endsWith(".js") ||
    filePath.endsWith(".jsx")
  );
}

function needsTestAttention(filePath) {
  return [
    "src/app/",
    "src/components/map/",
    "src/components/shop/",
    "src/lib/",
    "src/types/",
  ].some((prefix) => filePath.includes(prefix));
}

function isTestFile(filePath) {
  return (
    filePath.includes("__tests__/") ||
    filePath.endsWith(".test.ts") ||
    filePath.endsWith(".test.tsx") ||
    filePath.endsWith(".spec.ts") ||
    filePath.endsWith(".spec.tsx")
  );
}

function testFileExists(sourceFilePath) {
  const dir = path.dirname(sourceFilePath);
  const base = path.basename(sourceFilePath);
  const testDir = path.join(dir, "__tests__");
  const testFile = path.join(testDir, base);

  // Check __tests__/filename.test.tsx etc.
  const extensions = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
  const baseName = base.replace(/\.(ts|tsx|js|jsx)$/, "");
  return extensions.some((ext) => {
    return (
      fs.existsSync(path.join(testDir, baseName + ext)) ||
      fs.existsSync(path.join(dir, baseName + ext))
    );
  });
}

async function main() {
  const input = await readStdin();
  const filePath = input.tool_input?.file_path || "";

  if (!filePath || !isInterestingFile(filePath) || isTestFile(filePath)) {
    process.exit(0);
  }

  if (!needsTestAttention(filePath)) {
    process.exit(0);
  }

  // Types-only files don't need their own test suites
  if (filePath.includes("src/types/")) {
    process.exit(0);
  }

  const highRisk =
    filePath.includes("src/app/") ||
    filePath.includes("src/components/map/") ||
    filePath.includes("src/lib/");

  if (!highRisk) {
    process.exit(0);
  }

  // New file being created — no test yet is expected; allow with advisory
  if (!fs.existsSync(filePath)) {
    console.error(
      `[hook] New file: ${filePath} — add a test file before merging.`,
    );
    process.exit(0);
  }

  // If a test file already exists, allow with advisory message only
  if (testFileExists(filePath)) {
    console.error(
      `[hook] Test file exists for ${filePath} — verify coverage after change.`,
    );
    process.exit(0);
  }

  // No test found — block and prompt
  console.error(
    [
      "[hook] This change may require new or updated tests.",
      `Changed file: ${filePath}`,
      "",
      "Check whether one of the following applies:",
      "- new feature added",
      "- state flow changed",
      "- backend contract changed",
      "- map/list synchronization changed",
      "- no test exists for this critical area",
      "",
      "Consider running /write-tests for this area.",
    ].join("\n"),
  );

  process.exit(2);
}

main().catch((error) => {
  console.error(`[hook] flag-test-gap error: ${error.message}`);
  process.exit(1);
});
