import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // packages/shared 에는 별도 vitest 설정이 없다. 순수 유틸 테스트를 소스 옆에
    // 두면서도 실행되도록 여기서 함께 수집한다.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "../../packages/shared/src/**/*.{test,spec}.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/mocks/server-only.ts"),
    },
  },
});
