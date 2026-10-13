import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "node_modules", "*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "no-restricted-imports": ["error", { paths: [{ name: "zod", message: 'Import { z } from "@shared" (one zod copy, docs/DECISIONS.md D14).' }] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "error",
        {
          // Tokens only: no raw hex colours in className (docs/DESIGN_SYSTEM.md §9).
          selector: "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message: "Use theme.css colour tokens, not hex values.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "dangerouslySetInnerHTML is banned (docs/SECURITY.md T10).",
        },
      ],
    },
  },
);
