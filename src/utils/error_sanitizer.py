"""Utility to sanitize error messages and prevent information disclosure."""

import re
from typing import Union


def sanitize_validation_error(error: Union[str, Exception]) -> str:
    """
    Sanitize validation errors to remove framework-specific details.

    Args:
        error: The error message or exception to sanitize

    Returns:
        A clean, user-friendly error message without technical details
    """
    error_msg = str(error)

    # Remove Pydantic URLs and documentation links
    error_msg = re.sub(r"https?://[^\s]+", "", error_msg)

    # Remove technical type information
    error_msg = re.sub(r"\[type=[^\]]+\]", "", error_msg)
    error_msg = re.sub(r"input_value=[^\s,\]]+", "", error_msg)
    error_msg = re.sub(r"input_type=[^\s,\]]+", "", error_msg)

    # Remove "For further information visit..." messages
    error_msg = re.sub(r"For further information visit[^\n]*", "", error_msg)

    # Extract validation error count and messages
    if "validation error" in error_msg:
        # Try to extract just the field names and error messages
        lines = error_msg.split("\n")
        errors = []
        for line in lines:
            line = line.strip()
            # Skip technical lines
            if any(
                skip in line.lower()
                for skip in ["for further", "pydantic", "type=", "input_"]
            ):
                continue
            # Keep field names and error descriptions
            if line and not line.endswith("Schema"):
                # Clean up field names
                if line[0].isalpha() or line[0] == "_":
                    errors.append(line)

        if errors:
            # Return first 3 validation errors
            if len(errors) > 3:
                return f"Validation failed: {'; '.join(errors[:3])} (and {len(errors)-3} more)"
            return f"Validation failed: {'; '.join(errors)}"

    # If we can't parse it nicely, return a generic message
    # but try to preserve the core error if it's simple
    if len(error_msg) < 100 and "http" not in error_msg.lower():
        return error_msg.strip()

    return "Invalid input provided. Please check your data and try again."


def sanitize_pydantic_error(exception: Exception) -> str:
    """
    Sanitize Pydantic ValidationError to remove technical details.

    Args:
        exception: The Pydantic ValidationError exception

    Returns:
        User-friendly error message
    """
    # Try to extract just the field errors without technical details
    error_str = str(exception)

    # If this is a pydantic validation error, extract field-level errors
    if hasattr(exception, "errors"):
        errors = exception.errors()
        messages = []
        for error in errors[:3]:  # Limit to first 3 errors
            field = " -> ".join(str(loc) for loc in error.get("loc", []))
            msg = error.get("msg", "Invalid value")
            if field:
                messages.append(f"{field}: {msg}")
            else:
                messages.append(msg)
        if messages:
            return "Validation failed: " + "; ".join(messages)

    # Fall back to string sanitization
    return sanitize_validation_error(error_str)
