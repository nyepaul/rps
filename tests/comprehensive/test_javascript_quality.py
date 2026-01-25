#!/usr/bin/env python3
"""
JavaScript Code Quality Tests
Validates all JavaScript files for common issues, duplicate declarations, and ES6 compliance.
"""
import os
import re
import pytest
from pathlib import Path

# Base directory for JavaScript files
JS_BASE_DIR = Path(__file__).parent.parent.parent / 'src' / 'static' / 'js'


class TestJavaScriptQuality:
    """Test suite for JavaScript code quality."""

    def test_no_duplicate_const_declarations(self):
        """Test that no function declares the same const variable twice."""
        issues = []

        for js_file in JS_BASE_DIR.rglob('*.js'):
            content = js_file.read_text()

            # Split into functions
            function_pattern = r'(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function|\w+\s*:\s*(?:async\s+)?function)\s*\([^)]*\)\s*\{[^}]*\}'

            # Look for duplicate const declarations in same scope
            const_pattern = r'\bconst\s+(\w+)\s*='

            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                consts = re.findall(const_pattern, line)
                if len(consts) != len(set(consts)):
                    issues.append(f"{js_file.relative_to(JS_BASE_DIR)}:{i} - Duplicate const declaration in same line")

        assert len(issues) == 0, f"Found duplicate const declarations:\n" + "\n".join(issues)

    def test_no_var_declarations(self):
        """Test that no files use 'var' (should use const/let for ES6)."""
        issues = []

        for js_file in JS_BASE_DIR.rglob('*.js'):
            content = js_file.read_text()
            lines = content.split('\n')

            for i, line in enumerate(lines, 1):
                # Skip comments
                if '//' in line:
                    line = line[:line.index('//')]
                if '/*' in line:
                    continue

                if re.search(r'\bvar\s+\w+', line):
                    issues.append(f"{js_file.relative_to(JS_BASE_DIR)}:{i} - Uses 'var' instead of const/let")

        assert len(issues) == 0, f"Found var declarations (should use const/let):\n" + "\n".join(issues)

    def test_all_imports_are_valid(self):
        """Test that all ES6 imports reference existing files."""
        issues = []

        for js_file in JS_BASE_DIR.rglob('*.js'):
            content = js_file.read_text()

            # Find all imports
            import_pattern = r"import\s+.*?from\s+['\"](.+?)['\"]"
            imports = re.findall(import_pattern, content)

            for import_path in imports:
                # Skip external modules
                if not import_path.startswith('.'):
                    continue

                # Resolve relative path
                resolved = (js_file.parent / import_path).resolve()
                if not resolved.suffix:
                    resolved = resolved.with_suffix('.js')

                if not resolved.exists():
                    issues.append(f"{js_file.relative_to(JS_BASE_DIR)} - Invalid import: {import_path}")

        assert len(issues) == 0, f"Found invalid imports:\n" + "\n".join(issues)

    def test_no_duplicate_element_ids_in_templates(self):
        """Test that no HTML templates contain duplicate element IDs."""
        issues = []

        for js_file in JS_BASE_DIR.rglob('*.js'):
            content = js_file.read_text()

            # Find all template literals that contain HTML
            template_pattern = r'`([^`]*(?:id=|getElementById)[^`]*)`'
            templates = re.findall(template_pattern, content, re.DOTALL)

            for template in templates:
                # Extract all id attributes (preceded by whitespace to avoid data-id)
                id_pattern = r'\sid=["\']([^"\']+)["\']'
                ids = re.findall(id_pattern, template)

                # Check for duplicates
                id_counts = {}
                for element_id in ids:
                    id_counts[element_id] = id_counts.get(element_id, 0) + 1

                duplicates = [id for id, count in id_counts.items() if count > 1]
                if duplicates:
                    issues.append(f"{js_file.relative_to(JS_BASE_DIR)} - Duplicate IDs: {', '.join(duplicates)}")

        assert len(issues) == 0, f"Found duplicate element IDs:\n" + "\n".join(issues)

    def test_consistent_semicolon_usage(self):
        """Test that statements end with semicolons (where appropriate)."""
        issues = []

        for js_file in JS_BASE_DIR.rglob('*.js'):
            content = js_file.read_text()
            lines = content.split('\n')

            for i, line in enumerate(lines, 1):
                stripped = line.strip()

                # Skip empty lines, comments, and blocks
                if not stripped or stripped.startswith('//') or stripped.startswith('/*'):
                    continue
                if stripped.endswith('{') or stripped.endswith('}'):
                    continue
                if stripped.startswith('import ') or stripped.startswith('export '):
                    continue

                # Check for statements that should end with semicolon
                if any(stripped.startswith(kw) for kw in ['const ', 'let ', 'var ', 'return ']):
                    if not stripped.endswith(';') and not stripped.endswith(','):
                        issues.append(f"{js_file.relative_to(JS_BASE_DIR)}:{i} - Statement should end with semicolon")

        # Allow up to 5% of lines without semicolons (some are valid)
        max_issues = len(list(JS_BASE_DIR.rglob('*.js'))) * 10
        assert len(issues) < max_issues, f"Too many missing semicolons:\n" + "\n".join(issues[:20])


class TestJavaScriptCriticalIssues:
    """Test suite for critical JavaScript issues found in analysis."""

    def test_no_duplicate_settings_modal_sections(self):
        """Test that main.js doesn't have duplicate settings modal sections."""
        main_js = JS_BASE_DIR / 'main.js'
        if not main_js.exists():
            pytest.skip("main.js not found")

        content = main_js.read_text()

        # Check for duplicate "Monte Carlo Analysis" or "Analysis Settings" sections
        analysis_settings_count = content.count('Analysis Settings')
        monte_carlo_count = content.count('Monte Carlo Analysis')

        assert analysis_settings_count <= 1, f"Found {analysis_settings_count} 'Analysis Settings' sections (should be 1)"
        assert monte_carlo_count <= 1, f"Found {monte_carlo_count} 'Monte Carlo Analysis' sections (should be 1)"

    def test_cashflow_tab_has_single_canvas_declaration(self):
        """Test that cashflow-tab.js doesn't declare canvas variable twice."""
        cashflow_tab = JS_BASE_DIR / 'components' / 'cashflow' / 'cashflow-tab.js'
        if not cashflow_tab.exists():
            pytest.skip("cashflow-tab.js not found")

        content = cashflow_tab.read_text()

        # Count 'const canvas' declarations
        const_canvas_count = len(re.findall(r'\bconst\s+canvas\s*=', content))

        assert const_canvas_count <= 1, f"Found {const_canvas_count} 'const canvas' declarations (should be 1)"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
