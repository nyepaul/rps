"""RPS Version Information"""

import json
import os

# Load version from static config file
try:
    _version_file = os.path.join(os.path.dirname(__file__), "static", "version.json")
    with open(_version_file, "r") as f:
        _data = json.load(f)
        __version__ = _data.get("version", "0.0.0")
        __release_date__ = _data.get("release_date", "unknown")
        __release_notes__ = _data.get("release_notes", "")
except Exception:
    __version__ = "0.0.0"
    __release_date__ = "unknown"
    __release_notes__ = "unknown"
