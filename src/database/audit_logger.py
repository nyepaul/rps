"""Audit logging service for tracking data access and modifications."""

from datetime import datetime
from typing import Optional
from flask import request, has_request_context
from flask_login import current_user
from src.database.connection import db


class AuditLogger:
    """Service for logging CRUD operations and data access."""

    @staticmethod
    def log(
        action: str,
        table_name: str,
        record_id: Optional[int] = None,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Log an audit event.

        Args:
            action: Type of action (CREATE, READ, UPDATE, DELETE)
            table_name: Name of the table affected
            record_id: ID of the record affected (if applicable)
            user_id: ID of the user performing the action
            details: Additional details about the action (JSON string)
            ip_address: IP address of the client
            user_agent: User agent string of the client
        """
        # Get user_id from current_user if not provided
        if user_id is None and has_request_context():
            try:
                if current_user and current_user.is_authenticated:
                    user_id = current_user.id
            except Exception:
                pass

        # Get IP address and user agent from request if not provided
        if has_request_context():
            if ip_address is None:
                ip_address = request.remote_addr
            if user_agent is None:
                user_agent = request.headers.get("User-Agent", "")[:200]  # Limit length

        timestamp = datetime.now().isoformat()

        try:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO audit_log
                    (action, table_name, record_id, user_id, details, ip_address, user_agent, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        action,
                        table_name,
                        record_id,
                        user_id,
                        details,
                        ip_address,
                        user_agent,
                        timestamp,
                    ),
                )
                # Explicitly commit the audit log
                conn.commit()
        except Exception as e:
            # Don't let audit logging failures break the application
            # In production, you'd want to log this to a separate error log
            print(f"Audit logging failed: {e}")

    @staticmethod
    def log_create(
        table_name: str,
        record_id: int,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
    ):
        """Log a CREATE operation."""
        AuditLogger.log("CREATE", table_name, record_id, user_id, details)

    @staticmethod
    def log_read(
        table_name: str,
        record_id: Optional[int] = None,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
    ):
        """Log a READ operation."""
        AuditLogger.log("READ", table_name, record_id, user_id, details)

    @staticmethod
    def log_update(
        table_name: str,
        record_id: int,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
    ):
        """Log an UPDATE operation."""
        AuditLogger.log("UPDATE", table_name, record_id, user_id, details)

    @staticmethod
    def log_delete(
        table_name: str,
        record_id: int,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
    ):
        """Log a DELETE operation."""
        AuditLogger.log("DELETE", table_name, record_id, user_id, details)

    @staticmethod
    def get_logs(
        user_id: Optional[int] = None,
        table_name: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ):
        """
        Retrieve audit logs with optional filtering.

        Args:
            user_id: Filter by user ID
            table_name: Filter by table name
            action: Filter by action type
            limit: Maximum number of records to return

        Returns:
            List of audit log entries
        """
        query = "SELECT * FROM audit_log WHERE 1=1"
        params = []

        if user_id is not None:
            query += " AND user_id = ?"
            params.append(user_id)

        if table_name is not None:
            query += " AND table_name = ?"
            params.append(table_name)

        if action is not None:
            query += " AND action = ?"
            params.append(action)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        rows = db.execute(query, tuple(params))
        return [dict(row) for row in rows]

    @staticmethod
    def cleanup_old_logs(days: int = 90):
        """
        Delete audit logs older than specified days.

        Args:
            days: Number of days to retain logs (default: 90)
        """
        cutoff_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = cutoff_date.replace(day=cutoff_date.day - days)

        with db.get_connection() as conn:
            conn.execute(
                "DELETE FROM audit_log WHERE created_at < ?", (cutoff_date.isoformat(),)
            )


# Global audit logger instance
audit_logger = AuditLogger()


# Convenience functions
def log_create(
    table_name: str,
    record_id: int,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
):
    """Log a CREATE operation."""
    audit_logger.log_create(table_name, record_id, user_id, details)


def log_read(
    table_name: str,
    record_id: Optional[int] = None,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
):
    """Log a READ operation."""
    audit_logger.log_read(table_name, record_id, user_id, details)


def log_update(
    table_name: str,
    record_id: int,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
):
    """Log an UPDATE operation."""
    audit_logger.log_update(table_name, record_id, user_id, details)


def log_delete(
    table_name: str,
    record_id: int,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
):
    """Log a DELETE operation."""
    audit_logger.log_delete(table_name, record_id, user_id, details)
