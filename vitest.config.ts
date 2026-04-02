import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "shared",
          root: "./packages/shared",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "catalog",
          root: "./packages/catalog",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "planner",
          root: "./packages/planner",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        esbuild: {
          jsx: "automatic",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "apps/web/src"),
          },
        },
        test: {
          name: "web",
          root: "./apps/web",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./src/test-setup.ts"],
        },
      },
    ],
  },
});
