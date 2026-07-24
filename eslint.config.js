import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Enforce semantic design tokens. Use bg-success / bg-warning / bg-destructive / bg-info
      // (and their -soft variants) instead of raw Tailwind palette colors.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/\\b(bg|text|border|ring)-(emerald|red|green|amber|yellow|orange|rose|pink|blue|sky|indigo|violet|purple|teal|cyan|lime|fuchsia)-(50|100|200|300|400|500|600|700|800|900|950)\\b/]",
          message: "Use semantic tokens (bg-success, text-warning, border-destructive, bg-info-soft, etc.) instead of raw Tailwind palette colors. See src/index.css for the full token list.",
        },
        {
          selector: "TemplateElement[value.raw=/\\b(bg|text|border|ring)-(emerald|red|green|amber|yellow|orange|rose|pink|blue|sky|indigo|violet|purple|teal|cyan|lime|fuchsia)-(50|100|200|300|400|500|600|700|800|900|950)\\b/]",
          message: "Use semantic tokens (bg-success, text-warning, border-destructive, bg-info-soft, etc.) instead of raw Tailwind palette colors. See src/index.css for the full token list.",
        },
      ],
    },
    // shadcn primitives may use raw colors internally — exempt them.
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": "off" },
  },
);
