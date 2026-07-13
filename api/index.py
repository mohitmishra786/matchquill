"""
Vercel serverless fallback entrypoint for FastAPI.

Primary production deploy uses Vercel Services (see vercel.json) with
backend/app.main:app. This wrapper remains for local `vercel dev` and
legacy single-function deployments.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: F401