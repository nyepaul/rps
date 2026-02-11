"""WSGI entrypoint for production-like local runtime."""

import os

from src.app import create_app

app = create_app(os.environ.get("FLASK_ENV", "production"))
