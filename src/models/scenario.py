"""Scenario model with user ownership and encryption."""

from datetime import datetime
import json
from src.database.connection import db
from src.services.encryption_service import encrypt_dict, decrypt_dict


class Scenario:
    """Scenario model for what-if analyses."""

    def __init__(
        self,
        id=None,
        user_id=None,
        profile_id=None,
        name=None,
        parameters=None,
        parameters_iv=None,
        results=None,
        results_iv=None,
        created_at=None,
    ):
        self.id = id
        self.user_id = user_id
        self.profile_id = profile_id
        self.name = name
        self.parameters = parameters  # Encrypted ciphertext
        self.parameters_iv = parameters_iv  # IV for parameters
        self.results = results  # Encrypted ciphertext
        self.results_iv = results_iv  # IV for results
        self._decrypted_parameters = None
        self._decrypted_results = None
        self.created_at = created_at or datetime.now().isoformat()

    @staticmethod
    def get_by_id(scenario_id: int, user_id: int):
        """Get scenario by ID (with ownership check)."""
        row = db.execute_one(
            "SELECT * FROM scenarios WHERE id = ? AND user_id = ?",
            (scenario_id, user_id),
        )
        if row:
            return Scenario(**dict(row))
        return None

    @staticmethod
    def list_by_user(user_id: int):
        """List all scenarios for a user."""
        rows = db.execute(
            "SELECT * FROM scenarios WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
        return [Scenario(**dict(row)) for row in rows]

    def save(self):
        """Save or update scenario (encrypts data)."""
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Encrypt parameters if needed
            if self._decrypted_parameters is not None:
                self.parameters, self.parameters_iv = encrypt_dict(
                    self._decrypted_parameters
                )
            elif isinstance(self.parameters, dict):
                self.parameters, self.parameters_iv = encrypt_dict(self.parameters)

            # Encrypt results if needed
            if self._decrypted_results is not None:
                self.results, self.results_iv = encrypt_dict(self._decrypted_results)
            elif isinstance(self.results, dict):
                self.results, self.results_iv = encrypt_dict(self.results)

            if self.id is None:
                cursor.execute(
                    """
                    INSERT INTO scenarios (user_id, profile_id, name, parameters, parameters_iv, results, results_iv, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        self.user_id,
                        self.profile_id,
                        self.name,
                        self.parameters,
                        self.parameters_iv,
                        self.results,
                        self.results_iv,
                        self.created_at,
                    ),
                )
                self.id = cursor.lastrowid
            else:
                cursor.execute(
                    """
                    UPDATE scenarios
                    SET name = ?, parameters = ?, parameters_iv = ?, results = ?, results_iv = ?
                    WHERE id = ? AND user_id = ?
                """,
                    (
                        self.name,
                        self.parameters,
                        self.parameters_iv,
                        self.results,
                        self.results_iv,
                        self.id,
                        self.user_id,
                    ),
                )
        return self

    def delete(self):
        """Delete scenario."""
        if self.id:
            with db.get_connection() as conn:
                conn.execute(
                    "DELETE FROM scenarios WHERE id = ? AND user_id = ?",
                    (self.id, self.user_id),
                )

    def to_dict(self):
        """Convert to dictionary (decrypts data)."""
        # Decrypt parameters
        parameters_decrypted = None
        if self.parameters and self.parameters_iv:
            try:
                parameters_decrypted = decrypt_dict(self.parameters, self.parameters_iv)
            except Exception:
                # Fallback to plain JSON
                if isinstance(self.parameters, str):
                    try:
                        parameters_decrypted = json.loads(self.parameters)
                    except json.JSONDecodeError:
                        pass
        elif isinstance(self.parameters, str):
            try:
                parameters_decrypted = json.loads(self.parameters)
            except json.JSONDecodeError:
                pass
        else:
            parameters_decrypted = self.parameters

        # Decrypt results
        results_decrypted = None
        if self.results and self.results_iv:
            try:
                results_decrypted = decrypt_dict(self.results, self.results_iv)
            except Exception:
                # Fallback to plain JSON
                if isinstance(self.results, str):
                    try:
                        results_decrypted = json.loads(self.results)
                    except json.JSONDecodeError:
                        pass
        elif isinstance(self.results, str):
            try:
                results_decrypted = json.loads(self.results)
            except json.JSONDecodeError:
                pass
        else:
            results_decrypted = self.results

        return {
            "id": self.id,
            "user_id": self.user_id,
            "profile_id": self.profile_id,
            "name": self.name,
            "parameters": parameters_decrypted,
            "results": results_decrypted,
            "created_at": self.created_at,
        }
