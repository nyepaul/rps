"""Budget and expense management routes."""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from src.models.profile import Profile
from src.services.enhanced_audit_logger import enhanced_audit_logger

budget_bp = Blueprint("budget", __name__, url_prefix="/api/budget")


@budget_bp.route("/copy-expenses", methods=["POST"])
@login_required
def copy_expenses():
    """Copy pre-retirement expenses to post-retirement."""
    data = request.json
    profile_name = data.get("profile_name")
    mode = data.get("mode", "replace")  # 'merge' or 'replace'

    if not profile_name:
        return jsonify({"error": "profile_name is required"}), 400

    try:
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        budget = profile_data.get("budget", {})
        expenses = budget.get("expenses", {})

        current_expenses = expenses.get("current", {})
        future_expenses = expenses.get("future", {})

        if mode == "replace":
            # Deep copy current to future
            import copy

            expenses["future"] = json_safe_copy(current_expenses)
        else:
            # Merge logic
            for cat, items in current_expenses.items():
                if cat not in future_expenses:
                    future_expenses[cat] = json_safe_copy(items)
                else:
                    # If items are lists, append. If they are objects, convert to list and append.
                    existing = future_expenses[cat]
                    new_items = json_safe_copy(items)

                    if not isinstance(existing, list):
                        existing = [existing] if existing else []

                    if not isinstance(new_items, list):
                        new_items = [new_items] if new_items else []

                    # Basic duplicate prevention by name
                    for new_item in new_items:
                        is_dup = any(
                            e.get("name") == new_item.get("name")
                            and e.get("amount") == new_item.get("amount")
                            for e in existing
                        )
                        if not is_dup:
                            existing.append(new_item)

                    future_expenses[cat] = existing

        budget["expenses"] = expenses
        profile_data["budget"] = budget
        profile.data = profile_data
        profile.save()

        enhanced_audit_logger.log(
            action="COPY_EXPENSES",
            table_name="profile",
            record_id=profile.id,
            details={"profile_name": profile_name, "mode": mode},
            status_code=200,
        )

        return (
            jsonify(
                {
                    "message": f"Expenses copied successfully ({mode})",
                    "expenses": expenses["future"],
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error copying expenses: {str(e)}")
        return jsonify({"error": str(e)}), 500


def json_safe_copy(obj):
    import json

    return json.loads(json.dumps(obj))
