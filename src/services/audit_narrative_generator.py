"""
Audit Log Narrative Generator

Converts audit log entries into human-readable narrative timelines.
Describes user actions in plain English for easy comprehension.
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from src.database import connection


class AuditNarrativeGenerator:
    """Generates human-readable narratives from audit logs."""

    @staticmethod
    def generate_user_timeline(
        user_id: int,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        """
        Generate a narrative timeline for a user's actions.

        Args:
            user_id: ID of the user
            start_date: Optional start date (ISO format)
            end_date: Optional end date (ISO format)
            limit: Maximum number of events to include

        Returns:
            Dictionary with narrative timeline and metadata
        """
        # Fetch audit logs for the user
        logs = AuditNarrativeGenerator._fetch_user_logs(
            user_id, start_date, end_date, limit
        )

        if not logs:
            return {
                "user_id": user_id,
                "event_count": 0,
                "narrative": "No activity recorded for this user.",
                "events": [],
            }

        # Generate narrative events
        narrative_events = []
        for log in logs:
            event = AuditNarrativeGenerator._log_to_narrative(log)
            if event:
                narrative_events.append(event)

        # Generate summary
        summary = AuditNarrativeGenerator._generate_summary(narrative_events)

        return {
            "user_id": user_id,
            "event_count": len(narrative_events),
            "summary": summary,
            "narrative": AuditNarrativeGenerator._format_narrative(narrative_events),
            "events": narrative_events,
        }

    @staticmethod
    def _fetch_user_logs(
        user_id: int, start_date: Optional[str], end_date: Optional[str], limit: int
    ) -> List[Dict[str, Any]]:
        """Fetch audit logs for a user from database."""
        try:
            with connection.db.get_connection() as conn:
                cursor = conn.cursor()

                # Build query with optional date filters
                query = """
                    SELECT
                        id, action, table_name, record_id, user_id,
                        details, ip_address, user_agent, created_at,
                        request_method, request_endpoint, session_id,
                        device_info, geo_location, status_code
                    FROM enhanced_audit_log
                    WHERE user_id = ?
                """
                params = [user_id]

                if start_date:
                    query += " AND created_at >= ?"
                    params.append(start_date)

                if end_date:
                    query += " AND created_at <= ?"
                    params.append(end_date)

                query += " ORDER BY created_at ASC LIMIT ?"
                params.append(limit)

                cursor.execute(query, params)
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                return [dict(zip(columns, row)) for row in rows]

        except Exception as e:
            print(f"Error fetching user logs: {e}")
            return []

    @staticmethod
    def _log_to_narrative(log: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert a single audit log entry into a narrative event."""
        try:
            action = log.get("action", "")
            table = log.get("table_name", "")
            details = log.get("details", "{}")
            timestamp = log.get("created_at", "")
            endpoint = log.get("request_endpoint", "")

            # Parse details JSON
            try:
                details_dict = json.loads(details) if isinstance(details, str) else {}
            except:
                details_dict = {}

            # Check for human-readable description in details
            description = details_dict.get("_description")
            if description:
                return {
                    "timestamp": timestamp,
                    "action": action,
                    "description": description,
                    "context": AuditNarrativeGenerator._extract_context(
                        log, details_dict
                    ),
                }

            # Generate description based on action type
            description = AuditNarrativeGenerator._generate_description(
                action, table, details_dict, endpoint, log
            )

            if not description:
                return None

            return {
                "timestamp": timestamp,
                "action": action,
                "description": description,
                "context": AuditNarrativeGenerator._extract_context(log, details_dict),
            }

        except Exception as e:
            print(f"Error converting log to narrative: {e}")
            return None

    @staticmethod
    def _generate_description(
        action: str,
        table: str,
        details: Dict[str, Any],
        endpoint: str,
        log: Dict[str, Any],
    ) -> str:
        """Generate human-readable description based on action type."""

        # Login/Authentication actions
        if action == "LOGIN_ATTEMPT":
            success = details.get("success", False)
            username = details.get("username", "unknown user")
            if success:
                return f"Successfully logged in as {username}"
            else:
                error = details.get("error_message", "unknown error")
                return f"Failed login attempt for {username} - {error}"

        elif action == "LOGIN_SUCCESS":
            return "Successfully logged in"

        elif action == "LOGOUT":
            return "Logged out"

        # Profile actions
        elif action == "CREATE" and table == "profile":
            profile_name = details.get("name", "a new profile")
            return f"Created profile '{profile_name}'"

        elif action == "UPDATE" and table == "profile":
            profile_name = details.get("name") or details.get("profile_name", "profile")
            changes = details.get("changes", {})
            if changes:
                field_names = ", ".join(changes.keys())
                return f"Updated {profile_name}: modified {field_names}"
            return f"Updated profile '{profile_name}'"

        elif action == "DELETE" and table == "profile":
            profile_name = details.get("name", "a profile")
            return f"Deleted profile '{profile_name}'"

        elif action == "READ" and table == "profile":
            profile_name = details.get("name", "a profile")
            return f"Viewed profile '{profile_name}'"

        # Scenario actions
        elif action == "CREATE" and table == "scenario":
            scenario_name = details.get("name", "a new scenario")
            return f"Created scenario '{scenario_name}'"

        elif action == "UPDATE" and table == "scenario":
            scenario_name = details.get("name") or details.get(
                "scenario_name", "scenario"
            )
            return f"Updated scenario '{scenario_name}'"

        elif action == "DELETE" and table == "scenario":
            scenario_name = details.get("name", "a scenario")
            return f"Deleted scenario '{scenario_name}'"

        elif action == "RUN_ANALYSIS":
            scenario_name = details.get("scenario_name", "a scenario")
            profile_name = details.get("profile_name", "")
            if profile_name:
                return f"Ran Monte Carlo analysis for {profile_name} - {scenario_name}"
            return f"Ran Monte Carlo analysis for {scenario_name}"

        # Asset/Income/Expense actions
        elif action == "CREATE" and table == "asset":
            asset_name = details.get("name", "an asset")
            asset_type = details.get("type", "")
            if asset_type:
                return f"Added {asset_type} asset '{asset_name}'"
            return f"Added asset '{asset_name}'"

        elif action == "UPDATE" and table == "asset":
            asset_name = details.get("name", "an asset")
            changes = details.get("changes", {})
            if "balance" in changes:
                old_val = changes["balance"].get("old")
                new_val = changes["balance"].get("new")
                return f"Updated {asset_name} balance from ${old_val:,.2f} to ${new_val:,.2f}"
            return f"Updated asset '{asset_name}'"

        elif action == "CREATE" and table == "income":
            income_name = details.get("name", "income source")
            return f"Added income source '{income_name}'"

        elif action == "UPDATE" and table == "income":
            income_name = details.get("name", "income source")
            return f"Updated income source '{income_name}'"

        elif action == "CREATE" and table == "expense":
            expense_name = details.get("name", "expense")
            return f"Added expense '{expense_name}'"

        elif action == "UPDATE" and table == "expense":
            expense_name = details.get("name", "expense")
            return f"Updated expense '{expense_name}'"

        # UI Navigation actions
        elif action == "UI_PAGE_VIEW":
            page = details.get("page", "unknown page")
            profile_name = details.get("profile_name")
            if profile_name:
                return f"Navigated to {page} page (viewing {profile_name})"
            return f"Navigated to {page} page"

        elif action == "UI_TAB_SWITCH":
            tab = details.get("tab", "unknown tab")
            return f"Switched to {tab} tab"

        elif action == "UI_CLICK":
            # Try to extract meaningful info from click
            element_text = details.get("element_text") or details.get(
                "interactive_text", ""
            )
            interactive_type = details.get("interactive_type", details.get("tag", ""))

            if element_text:
                if interactive_type == "button":
                    return f"Clicked button '{element_text}'"
                elif interactive_type == "link":
                    return f"Clicked link '{element_text}'"
                elif interactive_type == "tab":
                    return f"Clicked tab '{element_text}'"
                return f"Clicked {interactive_type} '{element_text}'"
            return "Clicked on page element"

        elif action == "UI_FORM_SUBMIT":
            form_name = details.get("form_name") or details.get("form_id", "form")
            return f"Submitted {form_name}"

        elif action == "UI_SEARCH":
            search_term = details.get("search_term", "")
            result_count = details.get("result_count")
            if search_term and result_count is not None:
                return f"Searched for '{search_term}' ({result_count} results)"
            elif search_term:
                return f"Searched for '{search_term}'"
            return "Performed a search"

        elif action == "UI_MODAL_OPEN":
            modal_id = details.get("modal_id", "modal")
            return f"Opened {modal_id} modal"

        elif action == "UI_MODAL_CLOSE":
            modal_id = details.get("modal_id", "modal")
            return f"Closed {modal_id} modal"

        elif action == "UI_DOWNLOAD":
            filename = details.get("filename", "file")
            return f"Downloaded {filename}"

        # Session events
        elif action == "SESSION_START":
            return "Started new session"

        elif action == "SESSION_END":
            duration = details.get("duration_seconds")
            if duration:
                mins = duration // 60
                return f"Ended session (duration: {mins} minutes)"
            return "Ended session"

        elif action == "SESSION_IDLE":
            idle_time = details.get("idle_seconds", 0)
            mins = idle_time // 60
            return f"Became idle after {mins} minutes of inactivity"

        elif action == "SESSION_RESUME":
            return "Resumed activity"

        # Admin actions
        elif action == "ADMIN_ACCESS":
            return "Accessed admin panel"

        elif action == "ADMIN_ACCESS_DENIED":
            return "Attempted to access admin panel (denied)"

        # Network access
        elif action == "NETWORK_ACCESS":
            endpoint = details.get("endpoint") or log.get("request_endpoint", "")
            method = details.get("method") or log.get("request_method", "")
            if endpoint:
                # Try to make a more readable description
                if endpoint.startswith("/api/"):
                    parts = endpoint.split("/")
                    resource = parts[2] if len(parts) > 2 else "API"
                    return (
                        f"API request: {method} {endpoint}"
                        if method
                        else f"API request to {endpoint}"
                    )
                elif endpoint == "/" or endpoint == "/index.html":
                    return "Loaded main application"
                elif endpoint == "/login":
                    return "Viewed login page"
                else:
                    return (
                        f"Requested {method} {endpoint}"
                        if method
                        else f"Requested {endpoint}"
                    )
            return "Network request"

        # Report generation
        elif action == "GENERATE_REPORT":
            report_type = details.get("report_type", "report")
            return f"Generated {report_type} report"

        elif action == "DOWNLOAD_REPORT":
            report_type = details.get("report_type", "report")
            return f"Downloaded {report_type} report"

        # Generic CRUD
        elif action == "CREATE":
            return f"Created {table} record"

        elif action == "UPDATE":
            return f"Updated {table} record"

        elif action == "DELETE":
            return f"Deleted {table} record"

        elif action == "READ":
            return f"Viewed {table} record"

        # Fallback
        return f"{action} on {table}" if table else action

    @staticmethod
    def _extract_context(
        log: Dict[str, Any], details: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract relevant context from log entry."""
        context = {}

        # IP and location
        if log.get("ip_address"):
            context["ip_address"] = log["ip_address"]

        geo = log.get("geo_location")
        if geo:
            try:
                geo_data = json.loads(geo) if isinstance(geo, str) else geo
                location_parts = []
                if geo_data.get("city"):
                    location_parts.append(geo_data["city"])
                if geo_data.get("region"):
                    location_parts.append(geo_data["region"])
                if geo_data.get("country"):
                    location_parts.append(geo_data["country"])
                if location_parts:
                    context["location"] = ", ".join(location_parts)
            except:
                pass

        # Device info
        device_info = log.get("device_info")
        if device_info:
            try:
                device_data = (
                    json.loads(device_info)
                    if isinstance(device_info, str)
                    else device_info
                )
                if device_data.get("browser"):
                    context["browser"] = device_data["browser"]
                if device_data.get("os"):
                    context["os"] = device_data["os"]
                if device_data.get("device_type"):
                    context["device"] = device_data["device_type"]
            except:
                pass

        # Profile/scenario context
        if details.get("profile_name"):
            context["profile"] = details["profile_name"]
        if details.get("scenario_name"):
            context["scenario"] = details["scenario_name"]

        return context

    @staticmethod
    def _generate_summary(events: List[Dict[str, Any]]) -> str:
        """Generate a summary of user activity."""
        if not events:
            return "No activity recorded."

        # Count action types
        action_counts = {}
        for event in events:
            action = event.get("action", "UNKNOWN")
            action_counts[action] = action_counts.get(action, 0) + 1

        # Build summary
        total = len(events)
        summary_parts = [f"{total} actions recorded"]

        # Highlight key activities
        highlights = []
        if action_counts.get("LOGIN_SUCCESS") or action_counts.get("LOGIN_ATTEMPT"):
            login_count = action_counts.get("LOGIN_SUCCESS", 0) + action_counts.get(
                "LOGIN_ATTEMPT", 0
            )
            highlights.append(f"{login_count} login(s)")

        if action_counts.get("CREATE"):
            highlights.append(f"{action_counts['CREATE']} creation(s)")

        if action_counts.get("UPDATE"):
            highlights.append(f"{action_counts['UPDATE']} update(s)")

        if action_counts.get("RUN_ANALYSIS"):
            highlights.append(f"{action_counts['RUN_ANALYSIS']} analysis run(s)")

        if highlights:
            summary_parts.append("including " + ", ".join(highlights))

        return ". ".join(summary_parts) + "."

    @staticmethod
    def _format_narrative(events: List[Dict[str, Any]]) -> str:
        """Format events into a readable narrative."""
        if not events:
            return "No activity recorded."

        narrative_parts = []
        for i, event in enumerate(events):
            timestamp = event.get("timestamp", "")
            description = event.get("description", "Unknown action")

            # Format timestamp
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                time_str = dt.strftime("%I:%M %p").lstrip("0")
            except:
                time_str = timestamp

            # Add connector words for flow
            if i == 0:
                connector = "The user "
            else:
                connector = ", then "

            narrative_parts.append(f"{connector}{description.lower()} at {time_str}")

        return "".join(narrative_parts) + "."


# Export singleton
audit_narrative_generator = AuditNarrativeGenerator()
