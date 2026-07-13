import nextConfig from "eslint-config-next";

const preExistingIssues = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
};

const customRules = {
  ...preExistingIssues,
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
};

const eslintConfig = [
  ...nextConfig,
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
    rules: customRules,
  },
];

export default eslintConfig;
