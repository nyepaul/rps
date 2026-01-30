"""Group model for user management."""

from datetime import datetime
from src.database import connection


class Group:
    """Group model."""

    def __init__(self, id, name, description=None, created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.description = description
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()

    @staticmethod
    def get_by_id(group_id: int):
        """Get group by ID."""
        row = connection.db.execute_one("SELECT * FROM groups WHERE id = ?", (group_id,))
        if row:
            return Group(**dict(row))
        return None

    @staticmethod
    def get_all():
        """Get all groups."""
        rows = connection.db.execute("SELECT * FROM groups ORDER BY name ASC")
        return [Group(**dict(row)) for row in rows]

    def save(self):
        """Save or update group."""
        with connection.db.get_connection() as conn:
            cursor = conn.cursor()
            if self.id is None:
                cursor.execute(
                    "INSERT INTO groups (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (self.name, self.description, self.created_at, self.updated_at),
                )
                self.id = cursor.lastrowid
            else:
                self.updated_at = datetime.now().isoformat()
                cursor.execute(
                    "UPDATE groups SET name = ?, description = ?, updated_at = ? WHERE id = ?",
                    (self.name, self.description, self.updated_at, self.id),
                )
        return self

    def delete(self):
        """Delete group."""
        if self.id:
            with connection.db.get_connection() as conn:
                conn.execute("DELETE FROM groups WHERE id = ?", (self.id,))

    def get_members(self):
        """Get all users in this group."""
        from src.auth.models import User

        rows = connection.db.execute(
            """
            SELECT u.* FROM users u
            JOIN user_groups ug ON u.id = ug.user_id
            WHERE ug.group_id = ?
        """,
            (self.id,),
        )
        return [User(**dict(row)) for row in rows]

    def add_member(self, user_id: int):
        """Add a user to this group."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)",
                (user_id, self.id),
            )

    def remove_member(self, user_id: int):
        """Remove a user from this group."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "DELETE FROM user_groups WHERE user_id = ? AND group_id = ?",
                (user_id, self.id),
            )

    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
