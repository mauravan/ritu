import path from "node:path";
export default {
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        "src/lib/**": { branches: 80, statements: 80 },
        "src/app/components/**": { branches: 80, statements: 80 },
        "src/app/api/**": { branches: 80, statements: 80 },
        branches: 80,
        statements: 80,
      },
    },
  },
};
