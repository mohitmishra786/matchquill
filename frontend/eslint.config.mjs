import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".vercel/**",
      "node_modules/**",
      "public/**",
      "*.config.js",
      "*.config.ts",
      "instrumentation*.ts",
      "sentry*.config.ts",
    ],
  },
  {
    // Prevent accidental raw SQL string concatenation (SQL injection risk).
    // Prefer Prisma query builders; $queryRaw must use tagged template literals.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='$queryRaw'][arguments.length>0]:not([arguments.0.type='TemplateLiteral']):not([arguments.0.type='TaggedTemplateExpression'])",
          message:
            "Do not pass raw strings to $queryRaw. Use Prisma.sql`...` tagged templates only.",
        },
        {
          selector:
            "CallExpression[callee.property.name='$executeRaw'][arguments.length>0]:not([arguments.0.type='TemplateLiteral']):not([arguments.0.type='TaggedTemplateExpression'])",
          message:
            "Do not pass raw strings to $executeRaw. Use Prisma.sql`...` tagged templates only.",
        },
        {
          selector:
            "CallExpression[callee.property.name='$queryRawUnsafe']",
          message:
            "Avoid $queryRawUnsafe. Use typed Prisma queries or Prisma.sql tagged templates.",
        },
        {
          selector:
            "CallExpression[callee.property.name='$executeRawUnsafe']",
          message:
            "Avoid $executeRawUnsafe. Use typed Prisma queries or Prisma.sql tagged templates.",
        },
      ],
    },
  },
];

export default eslintConfig;
