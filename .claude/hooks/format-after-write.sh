#!/bin/bash
set -e

INPUT="$(cat)"
FILE_PATH=$(printf '%s' "$INPUT" | node -e '
let data = "";
process.stdin.on("data", chunk => data += chunk);
process.stdin.on("end", () => {
  const json = JSON.parse(data);
  const filePath = json.tool_input?.file_path || "";
  process.stdout.write(filePath);
});
')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    npx prettier --write "$FILE_PATH" >/dev/null 2>&1 || true
    ;;
esac

exit 0
