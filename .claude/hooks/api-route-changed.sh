#!/bin/bash
# API route 파일 변경 감지 훅
# src/app/api/**route.ts 파일이 Write/Edit 될 때 docs 업데이트 및 Slack 공유를 알림

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if echo "$FILE" | grep -qE 'src/app/api/.*route\.ts$'; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"[API Contract Hook] route 파일 변경 감지: %s\n반드시 다음 두 가지를 완료하세요:\n1. docs/api-contracts.md 명세서를 최신 상태로 업데이트하세요\n2. Slack #dev-log 채널에 변경 내용을 공유하세요"}}' "$FILE"
fi
