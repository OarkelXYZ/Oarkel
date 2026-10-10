import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Brand art is served as pre-sized .webp; next/image renders blank at
    // icon sizes, so plain <img> is used on purpose.
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Fetched or generated, not our source:
    ".next-e2e/**",
    "contracts/lib/**",
    "contracts/out/**",
    "contracts/cache/**",
    "keeper/node_modules/**",
    "public/zk/**",
  ]),
]);

export default eslintConfig;
