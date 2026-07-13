"""
Shared backend constants.
"""

# Public API prefix when served behind Vercel / Next.js rewrites.
# Vercel does not strip path prefixes before invoking serverless functions
# (see https://vercel.com/docs/services/routing), so routes must include this prefix.
API_PREFIX = "/api/py"