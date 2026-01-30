"""
Fingerprint API Routes
Handles advanced browser fingerprinting data collection
"""

from flask import Blueprint, request, jsonify, session
from flask_login import current_user
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.database.connection import db
import json

fingerprint_bp = Blueprint("fingerprint", __name__, url_prefix="/api")


def get_stored_fingerprints(user_id: int, limit: int = 10) -> list:
    """Retrieve stored fingerprints for a user from audit log."""
    try:
        rows = db.execute(
            """SELECT details FROM enhanced_audit_log
               WHERE user_id = ? AND action = 'FINGERPRINT_COLLECTED'
               ORDER BY created_at DESC LIMIT ?""",
            (user_id, limit),
        )
        fingerprints = []
        for row in rows:
            try:
                details = json.loads(row["details"]) if row["details"] else {}
                fp_data = details.get("fingerprint_data", {})
                if fp_data.get("composite_fingerprint"):
                    fingerprints.append(fp_data["composite_fingerprint"])
            except (json.JSONDecodeError, TypeError):
                continue
        return fingerprints
    except Exception:
        return []


@fingerprint_bp.route("/fingerprint", methods=["POST"])
def collect_fingerprint():
    """
    Receive and store browser fingerprint data from client.

    This endpoint receives comprehensive fingerprint data including:
    - Canvas fingerprinting
    - WebGL fingerprinting
    - Audio context fingerprinting
    - Font detection
    - Screen details
    - Hardware information
    - Battery status
    - Connection info
    - Media devices
    """
    try:
        fingerprint_data = request.get_json()

        if not fingerprint_data:
            return jsonify({"error": "No fingerprint data provided"}), 400

        # Get user ID if authenticated
        user_id = None
        if current_user and current_user.is_authenticated:
            user_id = current_user.id

        # Analyze fingerprint data
        analysis = enhanced_audit_logger.analyze_fingerprint_data(
            fingerprint_data, ip_geolocation=None  # Could retrieve from audit log
        )

        # Combine fingerprint data with analysis
        enhanced_details = {
            "fingerprint_data": fingerprint_data,
            "fingerprint_analysis": analysis,
        }

        # Log fingerprint collection with analysis
        enhanced_audit_logger.log(
            action="FINGERPRINT_COLLECTED",
            table_name="fingerprint",
            user_id=user_id,
            details=enhanced_details,
            status_code=200,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Fingerprint data received and analyzed",
                    "composite_fingerprint": fingerprint_data.get(
                        "composite_fingerprint"
                    ),
                    "analysis": {
                        "consistency_score": analysis["consistency_score"],
                        "risk_level": analysis["risk_level"],
                        "anomaly_count": len(analysis["anomalies"]),
                    },
                }
            ),
            200,
        )

    except Exception as e:
        enhanced_audit_logger.log(
            action="FINGERPRINT_ERROR",
            user_id=user_id if current_user and current_user.is_authenticated else None,
            error_message=str(e),
            status_code=500,
        )
        return jsonify({"error": "Failed to process fingerprint data"}), 500


@fingerprint_bp.route("/fingerprint/verify", methods=["POST"])
def verify_fingerprint():
    """
    Verify if a fingerprint matches the current session.
    Used for additional security verification.
    """
    try:
        data = request.get_json()
        composite_fingerprint = data.get("composite_fingerprint")

        if not composite_fingerprint:
            return jsonify({"error": "No fingerprint provided"}), 400

        # Check if user is authenticated
        if not current_user or not current_user.is_authenticated:
            # For unauthenticated users, check session-stored fingerprint
            session_fingerprint = session.get("fingerprint")
            if session_fingerprint:
                verified = session_fingerprint == composite_fingerprint
                return (
                    jsonify(
                        {
                            "success": True,
                            "verified": verified,
                            "match_type": "session",
                            "message": (
                                "Fingerprint verified against session"
                                if verified
                                else "Fingerprint mismatch"
                            ),
                        }
                    ),
                    200,
                )
            else:
                # No stored fingerprint, store this one
                session["fingerprint"] = composite_fingerprint
                return (
                    jsonify(
                        {
                            "success": True,
                            "verified": True,
                            "match_type": "new_session",
                            "message": "Fingerprint stored for session",
                        }
                    ),
                    200,
                )

        # For authenticated users, compare with stored fingerprints
        stored_fingerprints = get_stored_fingerprints(current_user.id)

        if not stored_fingerprints:
            # No stored fingerprints, this is the first one
            return (
                jsonify(
                    {
                        "success": True,
                        "verified": True,
                        "match_type": "first_fingerprint",
                        "message": "First fingerprint for user",
                    }
                ),
                200,
            )

        # Check if current fingerprint matches any stored fingerprint
        exact_match = composite_fingerprint in stored_fingerprints

        # Log the verification attempt
        enhanced_audit_logger.log(
            action="FINGERPRINT_VERIFIED" if exact_match else "FINGERPRINT_MISMATCH",
            table_name="fingerprint",
            user_id=current_user.id,
            details={
                "verified": exact_match,
                "stored_count": len(stored_fingerprints),
                "composite_fingerprint": (
                    composite_fingerprint[:32] + "..."
                    if len(composite_fingerprint) > 32
                    else composite_fingerprint
                ),
            },
            status_code=200 if exact_match else 403,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "verified": exact_match,
                    "match_type": "exact" if exact_match else "none",
                    "known_fingerprints": len(stored_fingerprints),
                    "message": (
                        "Fingerprint verified"
                        if exact_match
                        else "Fingerprint not recognized"
                    ),
                }
            ),
            200,
        )

    except Exception as e:
        enhanced_audit_logger.log(
            action="FINGERPRINT_VERIFY_ERROR",
            user_id=(
                current_user.id
                if current_user and current_user.is_authenticated
                else None
            ),
            error_message=str(e),
            status_code=500,
        )
        return jsonify({"error": "Verification failed"}), 500
