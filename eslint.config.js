import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  {
    // Worktrees and build output are not source. Listed first so nothing below
    // walks into them (this is the papercut that broke lint on the last repo).
    ignores: ["dist/**", "node_modules/**", ".claude/**", "coverage/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  prettier
];
