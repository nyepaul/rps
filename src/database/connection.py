"""Database connection management."""

import sqlite3
from contextlib import contextmanager
from typing import Generator
from src.config import Config


class Database:
    """SQLite database connection manager."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.DATABASE_PATH

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        conn.execute("PRAGMA foreign_keys = ON")  # Enable foreign keys
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def execute(self, query: str, params: tuple = ()):
        """Execute a query and return results."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchall()

    def execute_one(self, query: str, params: tuple = ()):
        """Execute a query and return one result."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()


# Global database instance
db = Database()
