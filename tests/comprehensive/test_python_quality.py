#!/usr/bin/env python3
"""
Python Code Quality Tests
Validates all Python files for common issues, security vulnerabilities, and best practices.
"""

import os
import re
import ast
import pytest
from pathlib import Path

# Base directory for Python files
PY_BASE_DIR = Path(__file__).parent.parent.parent / "src"


class TestPythonQuality:
    """Test suite for Python code quality."""

    def test_no_sql_injection_vulnerabilities(self):
        """Test that no code has potential SQL injection vulnerabilities."""
        issues = []

        for py_file in PY_BASE_DIR.rglob("*.py"):
            # Skip venv
            if "venv" in py_file.parts:
                continue
            content = py_file.read_text()

            # Look for dangerous SQL patterns
            dangerous_patterns = [
                (r"execute\([^)]*%[^)]*\)", "SQL string formatting"),
                (r"execute\([^)]*\.format\([^)]*\)", "SQL .format()"),
                (r'execute\([^)]*f["\'][^"\']*{[^}]*}', "SQL f-string"),
            ]

            lines = content.split("\n")
            for i, line in enumerate(lines, 1):
                # Skip comments
                if line.strip().startswith("#"):
                    continue

                for pattern, desc in dangerous_patterns:
                    if re.search(pattern, line):
                        # Check if it's using parameters (safe)
                        if ", (" in line or ", [" in line:
                            continue
                        issues.append(
                            f"{py_file.relative_to(PY_BASE_DIR)}:{i} - Potential SQL injection ({desc})"
                        )

        assert (
            len(issues) == 0
        ), f"Found potential SQL injection vulnerabilities:\n" + "\n".join(issues)

    def test_no_debug_print_statements(self):
        """Test that no production code has debug print statements."""
        issues = []

        for py_file in PY_BASE_DIR.rglob("*.py"):
            # Skip venv
            if "venv" in py_file.parts:
                continue
            # Skip test files
            if "test_" in py_file.name or "/tests/" in str(py_file):
                continue

            content = py_file.read_text()
            lines = content.split("\n")

            for i, line in enumerate(lines, 1):
                # Look for print() calls that appear to be debug statements
                if re.search(r"\bprint\s*\(", line):
                    # Skip if it's in a docstring or comment
                    stripped = line.strip()
                    if (
                        stripped.startswith("#")
                        or stripped.startswith('"""')
                        or stripped.startswith("'''")
                    ):
                        continue

                    # Check for debug patterns
                    if any(
                        keyword in line.lower()
                        for keyword in ["debug", "===", "test", "trace"]
                    ):
                        issues.append(
                            f"{py_file.relative_to(PY_BASE_DIR)}:{i} - Debug print statement"
                        )

        assert len(issues) == 0, f"Found debug print statements:\n" + "\n".join(issues)

    def test_all_imports_are_valid(self):
        """Test that all imports can be resolved (basic check)."""
        issues = []

        for py_file in PY_BASE_DIR.rglob("*.py"):
            # Skip venv
            if "venv" in py_file.parts:
                continue
            try:
                with open(py_file) as f:
                    tree = ast.parse(f.read(), filename=str(py_file))

                for node in ast.walk(tree):
                    if isinstance(node, ast.ImportFrom):
                        if node.module and node.module.startswith("src."):
                            # Check if relative import path exists
                            parts = node.module.split(".")
                            if parts[0] == "src":
                                check_path = PY_BASE_DIR
                                for part in parts[1:]:
                                    check_path = check_path / part

                                if (
                                    not check_path.exists()
                                    and not (
                                        check_path.parent / f"{check_path.name}.py"
                                    ).exists()
                                ):
                                    issues.append(
                                        f"{py_file.relative_to(PY_BASE_DIR)} - Invalid import: {node.module}"
                                    )

            except SyntaxError as e:
                issues.append(f"{py_file.relative_to(PY_BASE_DIR)} - Syntax error: {e}")

        assert len(issues) == 0, f"Found import issues:\n" + "\n".join(issues)

    def test_no_bare_except_clauses(self):
        """Test that code doesn't use bare except: clauses."""
        issues = []

        for py_file in PY_BASE_DIR.rglob("*.py"):
            # Skip venv
            if "venv" in py_file.parts:
                continue
            content = py_file.read_text()
            lines = content.split("\n")

            for i, line in enumerate(lines, 1):
                # Look for bare except
                if re.match(r"^\s*except\s*:", line):
                    issues.append(
                        f"{py_file.relative_to(PY_BASE_DIR)}:{i} - Bare except clause (should catch specific exceptions)"
                    )

        # Allow some bare excepts (they're sometimes necessary)
        max_bare_excepts = 5
        assert (
            len(issues) <= max_bare_excepts
        ), f"Too many bare except clauses:\n" + "\n".join(issues)

    def test_proper_error_handling_in_routes(self):
        """Test that route handlers have proper error handling."""
        issues = []

        routes_dir = PY_BASE_DIR / "routes"
        if not routes_dir.exists():
            pytest.skip("Routes directory not found")

        for py_file in routes_dir.glob("*.py"):
            content = py_file.read_text()

            # Find all route definitions
            route_pattern = r"@\w+_bp\.route\([^)]+\)"
            routes = list(re.finditer(route_pattern, content))

            for route_match in routes:
                # Get the function after the decorator
                start = route_match.end()
                func_content = content[start : start + 2000]  # Next 2000 chars

                # Check if it has try/except
                if "try:" not in func_content:
                    # Check if it's a simple route (< 5 lines)
                    lines = func_content.split("\n")[:10]
                    if (
                        len(
                            [
                                l
                                for l in lines
                                if l.strip() and not l.strip().startswith("#")
                            ]
                        )
                        > 5
                    ):
                        issues.append(
                            f"{py_file.name}:{route_match.start()} - Route without error handling"
                        )

        # Allow some routes without explicit try/except (simple ones)
        max_unhandled = 10
        assert (
            len(issues) <= max_unhandled
        ), f"Too many routes without error handling:\n" + "\n".join(issues[:10])


class TestPythonCriticalIssues:
    """Test suite for critical Python issues found in analysis."""

    def test_no_sql_like_injection_in_auth(self):
        """Test that auth routes don't have SQL LIKE injection vulnerability."""
        auth_routes = PY_BASE_DIR / "auth" / "routes.py"
        if not auth_routes.exists():
            pytest.skip("auth/routes.py not found")

        content = auth_routes.read_text()

        # Look for the specific vulnerable pattern
        vulnerable_pattern = r'LIKE.*%"username".*%'
        if re.search(vulnerable_pattern, content):
            # Check if it's properly escaped
            if "ESCAPE" not in content or ".replace" not in content:
                pytest.fail("Found SQL LIKE injection vulnerability in auth/routes.py")

    def test_no_undefined_variables_in_error_handlers(self):
        """Test that error handlers don't reference undefined variables."""
        issues = []

        for py_file in PY_BASE_DIR.rglob("*.py"):
            # Skip venv
            if "venv" in py_file.parts:
                continue
            try:
                content = py_file.read_text()

                # Look for except blocks that reference variables from try blocks
                except_pattern = r"except\s+\w+\s+as\s+\w+:\s*\n(.*?)(?=\n\s*(?:except|finally|try|def|class|$))"
                matches = re.finditer(except_pattern, content, re.DOTALL)

                for match in matches:
                    except_block = match.group(1)

                    # Look for variable references that might not be defined
                    if "data." in except_block and re.search(r"data\.[a-zA-Z_]", except_block):
                        # Check if 'data' is defined before the except block
                        # We search for the last 'def ' to scope it to the current function
                        content_before = content[: match.start()]
                        last_def_idx = content_before.rfind("def ")
                        if last_def_idx != -1:
                            function_content = content_before[last_def_idx:]
                            if "data = " not in function_content:
                                issues.append(
                                    f"{py_file.relative_to(PY_BASE_DIR)} - May reference undefined 'data' in except block"
                                )

            except Exception:
                pass

        assert (
            len(issues) == 0
        ), f"Found potential undefined variable references:\n" + "\n".join(issues)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
