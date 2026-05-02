/**
 * sync-tokens.ts
 * tokens.json을 읽어 src/styles/color.ts를 자동 생성합니다.
 *
 * 실행: npm run sync-tokens
 *
 * --- 워크플로우 ---
 * 1. 다예누나가 Penpot Library Colors에서 색상 변경
 * 2. 메인 세션(Claude)에서 MCP로 색상 추출 → tokens.json 업데이트
 *    (아래 MCP 추출 코드 참고)
 * 3. npm run sync-tokens → src/styles/color.ts 재생성
 * 4. git commit + PR
 *
 * --- Penpot MCP 추출 코드 (메인 세션에서 실행) ---
 * const set = penpot.library.local.tokens.sets.find(s => s.name === "gacha-map/colors");
 * const result = { color: { brand: {}, text: {}, neutral: {}, semantic: {} } };
 * const groupMap = { "color.brand": "brand", "color.text": "text", "color.neutral": "neutral", "color.semantic": "semantic" };
 * for (const t of set.tokens) {
 *   const prefix = t.name.split(".").slice(0, 2).join(".");
 *   const key = t.name.split(".").pop();
 *   const group = groupMap[prefix];
 *   if (group && key) result.color[group][key] = { value: t.value, type: "color" };
 * }
 * return result; // → tokens.json에 저장 후 npm run sync-tokens 실행
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface TokenEntry {
  value: string;
  type: string;
}

interface TokenGroup {
  [key: string]: TokenEntry;
}

interface TokenFile {
  color: {
    brand: TokenGroup;
    text: TokenGroup;
    neutral: TokenGroup;
    semantic: TokenGroup;
  };
}

// camelCase → SCREAMING_SNAKE_CASE (e.g. gray50 → GRAY_50, primaryBg → PRIMARY_BG)
function toScreamingSnake(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/(\d+)/g, "_$1")
    .toUpperCase()
    .replace(/^_/, "");
}

function generateColorTs(tokens: TokenFile): string {
  const lines: string[] = [
    "// AUTO-GENERATED — do not edit manually. Run: npm run sync-tokens",
    "// Source: tokens.json (synced from Penpot TokenCatalog)",
    "",
    "// Brand",
  ];

  for (const [key, token] of Object.entries(tokens.color.brand)) {
    lines.push(`export const ${toScreamingSnake(key)} = '${token.value}'`);
  }

  lines.push("", "// Design tokens (text)");
  for (const [key, token] of Object.entries(tokens.color.text)) {
    lines.push(`export const ${toScreamingSnake(key)} = '${token.value}'`);
  }

  lines.push("", "// Neutral");
  for (const [key, token] of Object.entries(tokens.color.neutral)) {
    lines.push(`export const ${toScreamingSnake(key)} = '${token.value}'`);
  }

  lines.push("", "// Semantic — Success");
  const semantic = tokens.color.semantic;
  const successKeys = ["successBg", "successBgHover", "successText"] as const;
  for (const key of successKeys) {
    if (semantic[key]) {
      lines.push(
        `export const ${toScreamingSnake(key)} = '${semantic[key].value}'`,
      );
    }
  }

  lines.push("", "// Semantic — Danger");
  const dangerKeys = ["dangerBg", "dangerBgHover", "dangerText"] as const;
  for (const key of dangerKeys) {
    if (semantic[key]) {
      lines.push(
        `export const ${toScreamingSnake(key)} = '${semantic[key].value}'`,
      );
    }
  }

  lines.push("", "// Semantic — Warning");
  if (semantic["warningText"]) {
    lines.push(
      `export const WARNING_TEXT = '${semantic["warningText"].value}'`,
    );
  }

  lines.push("", "// Semantic — Info");
  const infoKeys = ["infoBg", "infoBgHover", "infoText"] as const;
  for (const key of infoKeys) {
    if (semantic[key]) {
      lines.push(
        `export const ${toScreamingSnake(key)} = '${semantic[key].value}'`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

function main() {
  const tokensPath = path.join(ROOT, "tokens.json");
  const outputPath = path.join(ROOT, "src", "styles", "color.ts");

  if (!fs.existsSync(tokensPath)) {
    console.error("tokens.json not found:", tokensPath);
    process.exit(1);
  }

  const tokens: TokenFile = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));
  const content = generateColorTs(tokens);

  fs.writeFileSync(outputPath, content, "utf-8");
  console.log("✓ src/styles/color.ts generated from tokens.json");
}

main();
