import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Disable strict any type checking - allow any where needed for Supabase types
      "@typescript-eslint/no-explicit-any": "off",
      // Disable unused vars as errors - make them warnings only
      "@typescript-eslint/no-unused-vars": "warn",
      // Disable unescaped entities - allow quotes in JSX
      "react/no-unescaped-entities": "off",
      // Disable require imports restriction - we use dynamic imports
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
