"""
Feature Roadmap Routes
Manages product roadmap and feature planning - Super Admin only
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from src.database.connection import db
from datetime import datetime
import logging

roadmap_bp = Blueprint("roadmap", __name__)
logger = logging.getLogger(__name__)


def require_super_admin():
    """Check if current user is super admin."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    if not current_user.is_super_admin:
        return jsonify({"error": "Super admin access required"}), 403
    return None


@roadmap_bp.route("/api/roadmap", methods=["GET"])
@login_required
def get_roadmap():
    """Get all roadmap items - Super admin only."""
    auth_check = require_super_admin()
    if auth_check:
        return auth_check

    try:
        # Get query parameters for filtering
        category = request.args.get("category")
        priority = request.args.get("priority")
        phase = request.args.get("phase")
        status = request.args.get("status")

        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Build query with optional filters
            query = "SELECT * FROM feature_roadmap WHERE 1=1"
            params = []

            if category:
                query += " AND category = ?"
                params.append(category)
            if priority:
                query += " AND priority = ?"
                params.append(priority)
            if phase:
                query += " AND phase = ?"
                params.append(phase)
            if status:
                query += " AND status = ?"
                params.append(status)

            query += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, created_at DESC"

            cursor.execute(query, params)
            rows = cursor.fetchall()

            items = []
            for row in rows:
                items.append(
                    {
                        "id": row[0],
                        "title": row[1],
                        "description": row[2],
                        "category": row[3],
                        "priority": row[4],
                        "phase": row[5],
                        "status": row[6],
                        "impact": row[7],
                        "effort": row[8],
                        "target_version": row[9],
                        "assigned_to": row[10],
                        "notes": row[11],
                        "related_items": row[12],
                        "created_at": row[13],
                        "updated_at": row[14],
                        "completed_at": row[15],
                    }
                )

        return jsonify({"items": items}), 200

    except Exception as e:
        logger.error(f"Error fetching roadmap: {e}")
        return jsonify({"error": str(e)}), 500


@roadmap_bp.route("/api/roadmap/public", methods=["GET"])
@login_required
def get_public_roadmap():
    """Get roadmap items for public viewing - any authenticated user can access."""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Get all non-cancelled items, ordered by priority and phase
            query = """
                SELECT id, title, description, category, priority, phase, status,
                       impact, effort, target_version, created_at
                FROM feature_roadmap
                WHERE status != 'cancelled'
                ORDER BY
                    CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
                    CASE phase WHEN 'phase1' THEN 1 WHEN 'phase2' THEN 2 WHEN 'phase3' THEN 3 WHEN 'backlog' THEN 4 END,
                    created_at DESC
            """
            cursor.execute(query)
            rows = cursor.fetchall()

            items = []
            for row in rows:
                items.append(
                    {
                        "id": row[0],
                        "title": row[1],
                        "description": row[2],
                        "category": row[3],
                        "priority": row[4],
                        "phase": row[5],
                        "status": row[6],
                        "impact": row[7],
                        "effort": row[8],
                        "target_version": row[9],
                        "created_at": row[10],
                    }
                )

            # Get summary stats
            cursor.execute("""
                SELECT status, COUNT(*) FROM feature_roadmap
                WHERE status != 'cancelled'
                GROUP BY status
            """)
            status_counts = {row[0]: row[1] for row in cursor.fetchall()}

        return (
            jsonify(
                {
                    "items": items,
                    "stats": {
                        "total": len(items),
                        "completed": status_counts.get("completed", 0),
                        "in_progress": status_counts.get("in_progress", 0),
                        "planned": status_counts.get("planned", 0),
                    },
                    "can_edit": current_user.is_super_admin,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error fetching public roadmap: {e}")
        return jsonify({"error": str(e)}), 500


@roadmap_bp.route("/api/roadmap/<int:item_id>", methods=["GET"])
@login_required
def get_roadmap_item(item_id):
    """Get a specific roadmap item - Super admin only."""
    auth_check = require_super_admin()
    if auth_check:
        return auth_check

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM feature_roadmap WHERE id = ?", (item_id,))
            row = cursor.fetchone()

            if not row:
                return jsonify({"error": "Item not found"}), 404

            item = {
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "category": row[3],
                "priority": row[4],
                "phase": row[5],
                "status": row[6],
                "impact": row[7],
                "effort": row[8],
                "target_version": row[9],
                "assigned_to": row[10],
                "notes": row[11],
                "related_items": row[12],
                "created_at": row[13],
                "updated_at": row[14],
                "completed_at": row[15],
            }

        return jsonify({"item": item}), 200

    except Exception as e:
        logger.error(f"Error fetching roadmap item: {e}")
        return jsonify({"error": str(e)}), 500


@roadmap_bp.route("/api/roadmap", methods=["POST"])
@login_required
def create_roadmap_item():
    """Create a new roadmap item - Super admin only."""
    auth_check = require_super_admin()
    if auth_check:
        return auth_check

    try:
        data = request.get_json()

        # Validate required fields
        if not data.get("title"):
            return jsonify({"error": "Title is required"}), 400
        if not data.get("category"):
            return jsonify({"error": "Category is required"}), 400

        with db.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                INSERT INTO feature_roadmap
                (title, description, category, priority, phase, status, impact, effort,
                 target_version, assigned_to, notes, related_items)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    data.get("title"),
                    data.get("description"),
                    data.get("category"),
                    data.get("priority", "medium"),
                    data.get("phase", "backlog"),
                    data.get("status", "planned"),
                    data.get("impact"),
                    data.get("effort"),
                    data.get("target_version"),
                    data.get("assigned_to"),
                    data.get("notes"),
                    data.get("related_items"),
                ),
            )

            item_id = cursor.lastrowid

        logger.info(
            f"Roadmap item created by {current_user.username}: {data.get('title')}"
        )
        return (
            jsonify({"id": item_id, "message": "Roadmap item created successfully"}),
            201,
        )

    except Exception as e:
        logger.error(f"Error creating roadmap item: {e}")
        return jsonify({"error": str(e)}), 500


@roadmap_bp.route("/api/roadmap/<int:item_id>", methods=["PUT"])
@login_required
def update_roadmap_item(item_id):
    """Update a roadmap item - Super admin only."""
    auth_check = require_super_admin()
    if auth_check:
        return auth_check

    try:
        data = request.get_json()

        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Check if item exists
            cursor.execute("SELECT id FROM feature_roadmap WHERE id = ?", (item_id,))
            if not cursor.fetchone():
                return jsonify({"error": "Item not found"}), 404

            # Update item
            completed_at = None
            if data.get("status") == "completed":
                completed_at = datetime.now().isoformat()

            cursor.execute(
                """
                UPDATE feature_roadmap
                SET title = COALESCE(?, title),
                    description = COALESCE(?, description),
                    category = COALESCE(?, category),
                    priority = COALESCE(?, priority),
                    phase = COALESCE(?, phase),
                    status = COALESCE(?, status),
                    impact = COALESCE(?, impact),
                    effort = COALESCE(?, effort),
                    target_version = COALESCE(?, target_version),
                    assigned_to = COALESCE(?, assigned_to),
                    notes = COALESCE(?, notes),
                    related_items = COALESCE(?, related_items),
                    updated_at = CURRENT_TIMESTAMP,
                    completed_at = COALESCE(?, completed_at)
                WHERE id = ?
            """,
                (
                    data.get("title"),
                    data.get("description"),
                    data.get("category"),
                    data.get("priority"),
                    data.get("phase"),
                    data.get("status"),
                    data.get("impact"),
                    data.get("effort"),
                    data.get("target_version"),
                    data.get("assigned_to"),
                    data.get("notes"),
                    data.get("related_items"),
                    completed_at,
                    item_id,
                ),
            )

        logger.info(f"Roadmap item {item_id} updated by {current_user.username}")
        return jsonify({"message": "Roadmap item updated successfully"}), 200

    except Exception as e:
        logger.error(f"Error updating roadmap item: {e}")
        return jsonify({"error": str(e)}), 500


@roadmap_bp.route("/api/roadmap/<int:item_id>", methods=["DELETE"])
@login_required
def delete_roadmap_item(item_id):
    """Delete a roadmap item - Super admin only."""
    auth_check = require_super_admin()
    if auth_check:
        return auth_check

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Check if item exists
            cursor.execute("SELECT title FROM feature_roadmap WHERE id = ?", (item_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Item not found"}), 404

            title = row[0]

            # Delete item
            cursor.execute("DELETE FROM feature_roadmap WHERE id = ?", (item_id,))

        logger.info(
            f"Roadmap item {item_id} ({title}) deleted by {current_user.username}"
        )
        return jsonify({"message": "Roadmap item deleted successfully"}), 200

    except Exception as e:
        logger.error(f"Error deleting roadmap item: {e}")
        return jsonify({"error": str(e)}), 500


@roadmap_bp.route("/api/roadmap/stats", methods=["GET"])
@login_required
def get_roadmap_stats():
    """Get roadmap statistics - Super admin only."""
    auth_check = require_super_admin()
    if auth_check:
        return auth_check

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Get counts by status
            cursor.execute("""
                SELECT
                    status,
                    COUNT(*) as count
                FROM feature_roadmap
                GROUP BY status
            """)
            status_counts = {row[0]: row[1] for row in cursor.fetchall()}

            # Get counts by phase
            cursor.execute("""
                SELECT
                    phase,
                    COUNT(*) as count
                FROM feature_roadmap
                GROUP BY phase
            """)
            phase_counts = {row[0]: row[1] for row in cursor.fetchall()}

            # Get counts by priority
            cursor.execute("""
                SELECT
                    priority,
                    COUNT(*) as count
                FROM feature_roadmap
                GROUP BY priority
            """)
            priority_counts = {row[0]: row[1] for row in cursor.fetchall()}

            # Get counts by category
            cursor.execute("""
                SELECT
                    category,
                    COUNT(*) as count
                FROM feature_roadmap
                GROUP BY category
                ORDER BY count DESC
            """)
            category_counts = {row[0]: row[1] for row in cursor.fetchall()}

        return (
            jsonify(
                {
                    "total": sum(status_counts.values()),
                    "by_status": status_counts,
                    "by_phase": phase_counts,
                    "by_priority": priority_counts,
                    "by_category": category_counts,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error fetching roadmap stats: {e}")
        return jsonify({"error": str(e)}), 500
