import js from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": ["warn", { checksVoidReturn: false }],
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/require-await": "warn",
    },
  },
  {
    ignores: ["dist/**"],
  },
);
