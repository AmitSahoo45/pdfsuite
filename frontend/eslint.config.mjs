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
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // Disables unused variable warnings
      "@typescript-eslint/no-explicit-any": "off", // Allows usage of 'any' type
      "react/no-unescaped-entities": "off", // Allows unescaped characters like '
    },
  },
];

export default eslintConfig;
