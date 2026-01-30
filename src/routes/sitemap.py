"""
Sitemap Route
Exposes the application's navigation structure for documentation and testing.
"""

from flask import Blueprint, jsonify
import json
import os

sitemap_bp = Blueprint("sitemap", __name__)


@sitemap_bp.route("/sitemap.json", methods=["GET"])
def get_sitemap():
    """
    Get the application navigation map (sitemap).

    Returns:
        JSON object containing tabs, modals, and other navigation elements.
    """
    # In a real scenario, this might be dynamically generated from registered blueprints
    # or read from the source of truth (the test navigation map).
    # For now, we serve the map we just created as the definition of the UI structure.

    # Path to the navigation map relative to this file
    # src/routes/sitemap.py -> tests/navigation_map.json is ../../tests/navigation_map.json
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        map_path = os.path.join(current_dir, "../../tests/navigation_map.json")

        if not os.path.exists(map_path):
            return jsonify({"error": "Sitemap definition not found"}), 404

        with open(map_path, "r") as f:
            data = json.load(f)

        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
