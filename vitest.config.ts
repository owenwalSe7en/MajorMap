import { defineConfig } from "vitest/config";

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
    ],
  },
});
