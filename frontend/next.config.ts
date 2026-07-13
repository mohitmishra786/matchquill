import type { NextConfig } from "next";
import path from "path";

import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Monorepo: trace files from repository root when building inside frontend/
  outputFileTracingRoot: path.join(__dirname, ".."),
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'lodash',
      'lodash-es',
    ],
  },
  async rewrites() {
    // Production routing is handled by root vercel.json (Vercel Services).
    // Dev-only proxy to local uvicorn.
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    return [
      {
        source: "/api/py/:path*",
        destination: "http://localhost:8000/api/py/:path*",
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "implement-from-scratch",
  project: "frontend",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});