"""Skills routes for serving educational content."""

import os
from flask import Blueprint, jsonify
from flask_login import login_required

skills_bp = Blueprint("skills", __name__, url_prefix="/api")


@skills_bp.route("/skills", methods=["GET"])
@login_required
def list_skills():
    """List all available skill files."""
    try:
        skills_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "skills"
        )

        if not os.path.exists(skills_dir):
            return jsonify({"skills": []}), 200

        skills = []
        for filename in os.listdir(skills_dir):
            if filename.endswith(".md"):
                skills.append(
                    {
                        "filename": filename,
                        "name": filename.replace("-SKILL.md", "")
                        .replace("-", " ")
                        .title(),
                    }
                )

        return jsonify({"skills": skills}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/skills/<filename>", methods=["GET"])
@login_required
def get_skill(filename):
    """Serve a specific skill markdown file."""
    try:
        # Security: only allow .md files and prevent directory traversal
        if not filename.endswith(".md") or ".." in filename or "/" in filename:
            return jsonify({"error": "Invalid filename"}), 400

        skills_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "skills"
        )
        file_path = os.path.join(skills_dir, filename)

        # Verify path is within skills directory
        if not os.path.abspath(file_path).startswith(os.path.abspath(skills_dir)):
            return jsonify({"error": "Access denied"}), 403

        if not os.path.exists(file_path):
            return jsonify({"error": "Skill file not found"}), 404

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        return jsonify({"content": content, "filename": filename}), 200
    except Exception as e:
        return jsonify({"error": f"Error reading skill file: {str(e)}"}), 500
