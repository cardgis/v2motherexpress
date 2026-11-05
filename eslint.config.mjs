import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Client Prisma généré : régénéré à chaque `prisma generate`, jamais édité
    // à la main. Le linter n'a rien à y dire et noyait les vraies erreurs.
    "src/generated/**",
    // Bibliothèques tierces minifiées servies telles quelles (jQuery, UIkit,
    // Slick…) : ce n'est pas notre code, on ne le corrige pas, on le met à jour.
    "public/**",
  ]),
]);

export default eslintConfig;
