import { defineConfig } from "vitest/config";

// Two projects so the corpus eval is a separately-runnable gate:
//   pnpm test -> --project unit    (colocated *.test.ts next to the source)
//   pnpm eval -> --project corpus  (precision/recall over the synthetic corpus)
// Keeping them apart makes a detection regression identifiable at a glance in
// the CI check list, rather than buried among unit failures.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node"
        }
      },
      {
        test: {
          name: "corpus",
          include: ["corpus/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000
        }
      }
    ]
  }
});
