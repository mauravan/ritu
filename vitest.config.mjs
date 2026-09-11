import path from "node:path";
export default {
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: { "src/lib/**": 80, global: 80 },
        statements: { "src/lib/**": 80, global: 80 },
      },
    },
  },
};
