"""Profile routes with authentication and ownership checks."""

from flask import Blueprint, request, jsonify, Response
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from src.models.profile import Profile
from src.services.asset_service import (
    assets_to_csv,
    csv_to_assets,
    merge_assets,
    sync_legacy_arrays,
)
from src.services.encryption_service import get_encryption_service
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.extensions import limiter

profiles_bp = Blueprint("profiles", __name__, url_prefix="/api")


class ProfileCreateSchema(BaseModel):
    """Schema for creating a profile."""

    name: str
    birth_date: Optional[str] = None
    retirement_date: Optional[str] = None
    data: Optional[dict] = None

    @validator("name")
    def validate_name(cls, v):
        import re

        if not v or not v.strip():
            raise ValueError("Profile name is required")
        if len(v) > 100:
            raise ValueError("Profile name must be less than 100 characters")
        # Prevent path traversal attacks - reject any path separators or traversal sequences
        if ".." in v or "/" in v or "\\" in v:
            raise ValueError("Profile name cannot contain path traversal characters")
        # Additional security: only allow alphanumeric, spaces, hyphens, underscores, and basic punctuation
        if not re.match(r"^[a-zA-Z0-9 _\-\(\)\.]+$", v):
            raise ValueError("Profile name contains invalid characters")
        return v.strip()

    @validator("birth_date", "retirement_date")
    def validate_date(cls, v):
        if v:
            try:
                datetime.fromisoformat(v)
            except ValueError:
                raise ValueError("Invalid date format. Use ISO format (YYYY-MM-DD)")
        return v


class ProfileUpdateSchema(BaseModel):
    """Schema for updating a profile."""

    name: Optional[str] = None
    birth_date: Optional[str] = None
    retirement_date: Optional[str] = None
    data: Optional[dict] = None

    @validator("name")
    def validate_name(cls, v):
        import re

        if v is not None:
            if not v.strip():
                raise ValueError("Profile name cannot be empty")
            if len(v) > 100:
                raise ValueError("Profile name must be less than 100 characters")
            # Prevent path traversal attacks - reject any path separators or traversal sequences
            if ".." in v or "/" in v or "\\" in v:
                raise ValueError(
                    "Profile name cannot contain path traversal characters"
                )
            # Additional security: only allow alphanumeric, spaces, hyphens, underscores, and basic punctuation
            if not re.match(r"^[a-zA-Z0-9 _\-\(\)\.]+$", v):
                raise ValueError("Profile name contains invalid characters")
            return v.strip()
        return v

    @validator("birth_date", "retirement_date")
    def validate_date(cls, v):
        if v:
            try:
                datetime.fromisoformat(v)
            except ValueError:
                raise ValueError("Invalid date format. Use ISO format (YYYY-MM-DD)")
        return v


@profiles_bp.route("/profiles", methods=["GET"])
@login_required
def list_profiles():
    """List all profiles for the current user."""
    try:
        profiles = Profile.list_by_user(current_user.id)
        enhanced_audit_logger.log(
            action="LIST_PROFILES",
            details={"profile_count": len(profiles)},
            status_code=200,
        )
        return jsonify({"profiles": profiles}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action="LIST_PROFILES_ERROR", details={"error": str(e)}, status_code=500
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profile/<name>", methods=["GET"])
@login_required
def get_profile(name: str):
    """Get a specific profile by name (with ownership check)."""
    try:
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="VIEW_PROFILE_NOT_FOUND",
                details={"profile_name": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        enhanced_audit_logger.log(
            action="VIEW_PROFILE",
            table_name="profile",
            record_id=profile.id,
            details={"profile_name": name},
            status_code=200,
        )
        return jsonify({"profile": profile.to_dict()}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action="VIEW_PROFILE_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profiles", methods=["POST"])
@login_required
def create_profile():
    """Create a new profile for the current user."""
    try:
        data = ProfileCreateSchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action="CREATE_PROFILE_VALIDATION_ERROR",
            details={"error": str(e)},
            status_code=400,
        )
        return jsonify({"error": str(e)}), 400

    try:
        # Check if profile with same name already exists for this user
        existing = Profile.get_by_name(data.name, current_user.id)
        if existing:
            enhanced_audit_logger.log(
                action="CREATE_PROFILE_DUPLICATE",
                details={"profile_name": data.name},
                status_code=409,
            )
            return jsonify({"error": "Profile with this name already exists"}), 409

        # Create new profile
        profile = Profile(
            user_id=current_user.id,
            name=data.name,
            birth_date=data.birth_date,
            retirement_date=data.retirement_date,
            data=data.data,
        )
        profile.save()

        enhanced_audit_logger.log(
            action="CREATE_PROFILE",
            table_name="profile",
            record_id=profile.id,
            details={
                "profile_name": data.name,
                "birth_date": data.birth_date,
                "retirement_date": data.retirement_date,
            },
            status_code=201,
        )
        return (
            jsonify(
                {
                    "message": "Profile created successfully",
                    "profile": profile.to_dict(),
                }
            ),
            201,
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action="CREATE_PROFILE_ERROR",
            details={"profile_name": request.json.get("name"), "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profile/<name>", methods=["PUT"])
@login_required
def update_profile(name: str):
    """Update a profile (with ownership check)."""
    try:
        data = ProfileUpdateSchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action="UPDATE_PROFILE_VALIDATION_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=400,
        )
        return jsonify({"error": str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="UPDATE_PROFILE_NOT_FOUND",
                details={"profile_name": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        # Track what fields are being updated
        updated_fields = []

        # Update fields if provided
        if data.name is not None:
            # Check if new name conflicts with another profile
            if data.name != profile.name:
                existing = Profile.get_by_name(data.name, current_user.id)
                if existing:
                    enhanced_audit_logger.log(
                        action="UPDATE_PROFILE_NAME_CONFLICT",
                        details={"profile_name": name, "new_name": data.name},
                        status_code=409,
                    )
                    return (
                        jsonify({"error": "Profile with this name already exists"}),
                        409,
                    )
                updated_fields.append("name")
            profile.name = data.name

        if data.birth_date is not None:
            updated_fields.append("birth_date")
            profile.birth_date = data.birth_date

        if data.retirement_date is not None:
            updated_fields.append("retirement_date")
            profile.retirement_date = data.retirement_date

        if data.data is not None:
            updated_fields.append("data")
            # CRITICAL: Preserve existing api_keys - they get masked in to_dict()
            # and we don't want to overwrite real keys with masked values
            existing_data = profile.data_dict or {}
            new_data = data.data
            if "api_keys" in existing_data and existing_data["api_keys"]:
                # Check if incoming api_keys are masked (contain bullet chars)
                incoming_keys = new_data.get("api_keys", {})
                if incoming_keys:
                    masked_chars = ["•", "●", "∙", "⋅", "⦁"]
                    is_masked = any(
                        any(char in str(v) for char in masked_chars)
                        for v in incoming_keys.values()
                        if v
                    )
                    if is_masked:
                        # Preserve existing keys, don't save masked values
                        new_data["api_keys"] = existing_data["api_keys"]
                else:
                    # No api_keys in incoming data, preserve existing
                    new_data["api_keys"] = existing_data["api_keys"]
            profile.data = new_data

        profile.save()

        enhanced_audit_logger.log(
            action="UPDATE_PROFILE",
            table_name="profile",
            record_id=profile.id,
            details={"profile_name": name, "updated_fields": updated_fields},
            status_code=200,
        )
        return (
            jsonify(
                {
                    "message": "Profile updated successfully",
                    "profile": profile.to_dict(),
                }
            ),
            200,
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action="UPDATE_PROFILE_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profile/<name>", methods=["DELETE"])
@login_required
def delete_profile(name: str):
    """Delete a profile (with ownership check)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="DELETE_PROFILE_NOT_FOUND",
                details={"profile_name": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        profile_id = profile.id
        profile.delete()

        enhanced_audit_logger.log(
            action="DELETE_PROFILE",
            table_name="profile",
            record_id=profile_id,
            details={"profile_name": name},
            status_code=200,
        )
        return jsonify({"message": "Profile deleted successfully"}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action="DELETE_PROFILE_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profile/<name>/clone", methods=["POST"])
@login_required
def clone_profile(name: str):
    """Clone an existing profile (with ownership check)."""
    try:
        # Get source profile with ownership check
        source_profile = Profile.get_by_name(name, current_user.id)
        if not source_profile:
            enhanced_audit_logger.log(
                action="CLONE_PROFILE_NOT_FOUND",
                details={"source_profile": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        # Get new profile name from request body
        new_name = request.json.get("new_name", f"{name} (Copy)")

        # Validate new name
        if not new_name or not new_name.strip():
            enhanced_audit_logger.log(
                action="CLONE_PROFILE_VALIDATION_ERROR",
                details={
                    "source_profile": name,
                    "error": "New profile name is required",
                },
                status_code=400,
            )
            return jsonify({"error": "New profile name is required"}), 400

        new_name = new_name.strip()
        if len(new_name) > 100:
            enhanced_audit_logger.log(
                action="CLONE_PROFILE_VALIDATION_ERROR",
                details={"source_profile": name, "error": "Name too long"},
                status_code=400,
            )
            return (
                jsonify({"error": "Profile name must be less than 100 characters"}),
                400,
            )

        # Check if profile with new name already exists
        existing = Profile.get_by_name(new_name, current_user.id)
        if existing:
            enhanced_audit_logger.log(
                action="CLONE_PROFILE_DUPLICATE",
                details={"source_profile": name, "new_name": new_name},
                status_code=409,
            )
            return jsonify({"error": "Profile with this name already exists"}), 409

        # Clone the profile data
        cloned_data = (
            source_profile.data_dict.copy() if source_profile.data_dict else {}
        )

        # Create new profile with cloned data
        cloned_profile = Profile(
            user_id=current_user.id,
            name=new_name,
            birth_date=source_profile.birth_date,
            retirement_date=source_profile.retirement_date,
            data=cloned_data,
        )
        cloned_profile.save()

        enhanced_audit_logger.log(
            action="CLONE_PROFILE",
            table_name="profile",
            record_id=cloned_profile.id,
            details={
                "source_profile": name,
                "source_profile_id": source_profile.id,
                "new_profile_name": new_name,
            },
            status_code=201,
        )
        return (
            jsonify(
                {
                    "message": f'Profile cloned successfully as "{new_name}"',
                    "profile": cloned_profile.to_dict(),
                }
            ),
            201,
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action="CLONE_PROFILE_ERROR",
            details={"source_profile": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profile/<name>/assets/export", methods=["GET"])
@login_required
def export_assets_csv(name: str):
    """Export all assets as CSV file."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="EXPORT_ASSETS_NOT_FOUND",
                details={"profile_name": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        # Get assets from profile data
        data_dict = profile.data_dict
        assets = data_dict.get(
            "assets",
            {
                "retirement_accounts": [],
                "taxable_accounts": [],
                "real_estate": [],
                "pensions_annuities": [],
                "other_assets": [],
            },
        )

        # Count assets for logging
        asset_count = sum(len(v) for v in assets.values() if isinstance(v, list))

        # Convert to CSV
        csv_content = assets_to_csv(assets)

        # Create response with CSV content
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{name.replace(' ', '_')}_assets_{timestamp}.csv"

        enhanced_audit_logger.log(
            action="EXPORT_ASSETS_CSV",
            table_name="profile",
            record_id=profile.id,
            details={
                "profile_name": name,
                "asset_count": asset_count,
                "filename": filename,
            },
            status_code=200,
        )
        return Response(
            csv_content,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action="EXPORT_ASSETS_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profile/<name>/assets/import", methods=["POST"])
@login_required
def import_assets_csv(name: str):
    """Import assets from CSV file (appends to existing assets)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="IMPORT_ASSETS_NOT_FOUND",
                details={"profile_name": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        # Check if file was uploaded
        if "file" not in request.files:
            enhanced_audit_logger.log(
                action="IMPORT_ASSETS_NO_FILE",
                details={"profile_name": name},
                status_code=400,
            )
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            enhanced_audit_logger.log(
                action="IMPORT_ASSETS_NO_FILE",
                details={"profile_name": name},
                status_code=400,
            )
            return jsonify({"error": "No file selected"}), 400

        # Read and parse CSV
        csv_content = file.read().decode("utf-8")

        try:
            new_assets = csv_to_assets(csv_content)
        except ValueError as e:
            enhanced_audit_logger.log(
                action="IMPORT_ASSETS_INVALID_CSV",
                details={
                    "profile_name": name,
                    "filename": file.filename,
                    "error": str(e),
                },
                status_code=400,
            )
            return jsonify({"error": f"Invalid CSV format: {str(e)}"}), 400

        # Get current profile data
        data_dict = profile.data_dict

        # Merge new assets with existing ones
        existing_assets = data_dict.get(
            "assets",
            {
                "retirement_accounts": [],
                "taxable_accounts": [],
                "real_estate": [],
                "pensions_annuities": [],
                "other_assets": [],
            },
        )

        merged_assets = merge_assets(existing_assets, new_assets)

        # Update profile data
        data_dict["assets"] = merged_assets

        # Sync legacy arrays for backward compatibility
        data_dict = sync_legacy_arrays(data_dict)

        # Save profile
        profile.data = data_dict
        profile.save()

        # Count imported assets
        imported_count = sum(len(v) for v in new_assets.values())

        enhanced_audit_logger.log(
            action="IMPORT_ASSETS_CSV",
            table_name="profile",
            record_id=profile.id,
            details={
                "profile_name": name,
                "filename": file.filename,
                "imported_count": imported_count,
            },
            status_code=200,
        )
        return (
            jsonify(
                {
                    "message": f"Successfully imported {imported_count} assets",
                    "assets": merged_assets,
                    "profile": profile.to_dict(),
                }
            ),
            200,
        )

    except Exception as e:
        enhanced_audit_logger.log(
            action="IMPORT_ASSETS_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@profiles_bp.route("/profiles/<name>/migrate-keys", methods=["POST"])
@login_required
def migrate_profile_keys(name: str):
    """Temporary endpoint to manually trigger key migration for a profile."""
    try:
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        data_dict = profile.data_dict
        if "api_keys" in data_dict:
            # Move to user
            user_keys = current_user.api_keys_dict
            user_keys.update(data_dict["api_keys"])
            current_user.api_keys_dict = user_keys
            current_user.save()

            # Remove from profile
            del data_dict["api_keys"]
            profile.data = data_dict
            profile.save()

            return jsonify({"message": "Keys migrated successfully"}), 200
        
        return jsonify({"message": "No keys found in profile"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@profiles_bp.route("/profile/<name>/transactions/import", methods=["POST"])
@login_required
@limiter.limit("10 per hour")
def import_transactions_stream(name: str):
    """
    Upload CSV, detect patterns, return reconciliation preview.
    Streams progress updates via NDJSON for better UX.
    Does NOT save to profile yet - preview only.
    """
    import json
    from src.services.transaction_analyzer import (
        parse_transaction_csv,
        sanitize_transaction,
        detect_income_patterns,
        detect_expense_patterns,
        reconcile_income,
    )

    def generate():
        try:
            # Verify ownership
            profile = Profile.get_by_name(name, current_user.id)
            if not profile:
                yield json.dumps(
                    {"status": "error", "error": "Profile not found"}
                ) + "\n"
                return

            # Get uploaded file
            file = request.files.get("file")
            if not file:
                yield json.dumps(
                    {"status": "error", "error": "No file uploaded"}
                ) + "\n"
                return

            # Validate file size (5MB limit)
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset to beginning

            if file_size > 5 * 1024 * 1024:  # 5MB
                yield json.dumps(
                    {"status": "error", "error": "File too large (max 5MB)"}
                ) + "\n"
                return

            # Step 1: Parse CSV
            yield json.dumps(
                {"status": "parsing", "progress": 10, "message": "Reading CSV file..."}
            ) + "\n"

            csv_content = file.read().decode("utf-8-sig")  # Handle BOM
            transactions = parse_transaction_csv(csv_content)

            if len(transactions) < 3:
                yield json.dumps(
                    {
                        "status": "error",
                        "error": "Not enough transactions (minimum 3 required)",
                    }
                ) + "\n"
                return

            # Step 2: Sanitize (strip PII)
            yield json.dumps(
                {
                    "status": "sanitizing",
                    "progress": 30,
                    "message": "Removing sensitive data...",
                }
            ) + "\n"

            sanitized = [sanitize_transaction(t) for t in transactions]

            # Step 3: Detect patterns
            yield json.dumps(
                {
                    "status": "detecting",
                    "progress": 50,
                    "message": "Analyzing patterns...",
                }
            ) + "\n"

            income_txns = [t for t in sanitized if t.amount > 0]
            expense_txns = [t for t in sanitized if t.amount < 0]

            detected_income = detect_income_patterns(income_txns)
            detected_expenses = detect_expense_patterns(expense_txns)

            # Step 4: Reconcile with existing data
            yield json.dumps(
                {
                    "status": "reconciling",
                    "progress": 80,
                    "message": "Comparing with your data...",
                }
            ) + "\n"

            data_dict = profile.data_dict
            specified_income = data_dict.get("income_streams", [])
            reconciliation = reconcile_income(specified_income, detected_income)

            # Step 5: Complete
            dates = [t.date for t in sanitized]
            date_range = {
                "start": min(dates).isoformat(),
                "end": max(dates).isoformat(),
            }

            # Convert dataclasses to dicts
            from dataclasses import asdict

            yield json.dumps(
                {
                    "status": "complete",
                    "progress": 100,
                    "message": "Analysis complete!",
                    "data": {
                        "transaction_count": len(transactions),
                        "income_count": len(income_txns),
                        "expense_count": len(expense_txns),
                        "date_range": date_range,
                        "detected_income": [asdict(d) for d in detected_income],
                        "detected_expenses": {
                            cat: [asdict(e) for e in expenses]
                            for cat, expenses in detected_expenses.items()
                        },
                        "reconciliation": {
                            "matches": [asdict(m) for m in reconciliation.matches],
                            "new_detected": [
                                asdict(d) for d in reconciliation.new_detected
                            ],
                            "manual_only": reconciliation.manual_only,
                            "summary": reconciliation.summary,
                        },
                    },
                }
            ) + "\n"

            # Audit logging
            enhanced_audit_logger.log(
                action="CSV_TRANSACTION_IMPORT",
                table_name="profile",
                record_id=profile.id,
                details={
                    "transaction_count": len(transactions),
                    "date_range": f"{date_range['start']} to {date_range['end']}",
                    "patterns_detected": len(detected_income)
                    + sum(len(e) for e in detected_expenses.values()),
                    "file_size_kb": round(len(csv_content) / 1024, 2),
                },
                status_code=200,
            )

        except ValueError as e:
            yield json.dumps({"status": "error", "error": str(e)}) + "\n"
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.exception("CSV import failed")
            yield json.dumps(
                {"status": "error", "error": "Import failed. Please check CSV format."}
            ) + "\n"

    return Response(generate(), mimetype="application/x-ndjson")


@profiles_bp.route("/profile/<name>/transactions/reconcile", methods=["POST"])
@login_required
def reconcile_transactions(name: str):
    """
    Apply reconciliation decisions to profile.
    Accepts user choices: merge, add_new, ignore, add_expense.
    """
    try:
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="RECONCILE_TRANSACTIONS_NOT_FOUND",
                details={"profile_name": name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        actions = request.json.get("actions", [])
        if not actions:
            return jsonify({"error": "No actions provided"}), 400

        data_dict = profile.data_dict
        applied_count = 0
        income_added = 0
        expenses_added = 0

        # Ensure income_streams exists
        if "income_streams" not in data_dict:
            data_dict["income_streams"] = []

        # Ensure budget structure exists
        if "budget" not in data_dict:
            data_dict["budget"] = {"expenses": {"current": {}, "future": {}}}
        if "expenses" not in data_dict["budget"]:
            data_dict["budget"]["expenses"] = {"current": {}, "future": {}}
        if "current" not in data_dict["budget"]["expenses"]:
            data_dict["budget"]["expenses"]["current"] = {}

        for action in actions:
            action_type = action.get("type")

            if action_type == "merge":
                # Update existing income stream with detected data
                stream_idx = action.get("stream_index")
                updates = action.get("updates", {})

                if stream_idx is not None and 0 <= stream_idx < len(
                    data_dict["income_streams"]
                ):
                    data_dict["income_streams"][stream_idx].update(
                        {
                            "amount": updates.get("amount"),
                            "frequency": updates.get("frequency"),
                            "source": "merged",
                            "detected_from": updates.get("detected_from"),
                            "confidence": updates.get("confidence"),
                            "variance": updates.get("variance"),
                            "first_seen": updates.get("first_seen"),
                            "last_seen": updates.get("last_seen"),
                            "detected_date": datetime.now().isoformat(),
                        }
                    )
                    applied_count += 1
                    income_added += 1

            elif action_type == "add_new":
                # Add new detected income stream
                new_stream = action.get("stream", {})
                new_stream["source"] = "detected"
                new_stream["detected_date"] = datetime.now().isoformat()
                data_dict["income_streams"].append(new_stream)
                applied_count += 1
                income_added += 1

            elif action_type == "ignore":
                # Just log - no action needed
                applied_count += 1

            elif action_type == "add_expense":
                # Add detected expense to budget
                category = action.get("category", "other")
                expense = action.get("expense", {})
                expense["source"] = "detected"
                expense["detected_date"] = datetime.now().isoformat()

                # Default to pre-retirement expenses
                period = "current"

                if category not in data_dict["budget"]["expenses"][period]:
                    data_dict["budget"]["expenses"][period][category] = []

                data_dict["budget"]["expenses"][period][category].append(expense)
                applied_count += 1
                expenses_added += 1

        # Save updated profile
        profile.data = data_dict
        profile.save()

        # Audit log
        enhanced_audit_logger.log(
            action="CSV_RECONCILE_APPLIED",
            table_name="profile",
            record_id=profile.id,
            details={
                "actions_applied": applied_count,
                "income_patterns_added": income_added,
                "expense_patterns_added": expenses_added,
                "profile_name": name,
            },
            status_code=200,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "actions_applied": applied_count,
                    "income_added": income_added,
                    "expenses_added": expenses_added,
                    "message": f"Successfully applied {applied_count} changes",
                }
            ),
            200,
        )

    except Exception as e:
        enhanced_audit_logger.log(
            action="RECONCILE_TRANSACTIONS_ERROR",
            details={"profile_name": name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500
