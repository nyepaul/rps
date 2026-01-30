import json
import os
import pytest


class TestNavigationMap:
    def test_navigation_map_integrity(self):
        """
        Verify that the navigation map accurately reflects the codebase.
        This ensures that all documented navigation paths point to existing files.
        """
        map_path = os.path.join(os.path.dirname(__file__), "navigation_map.json")
        with open(map_path, "r") as f:
            nav_map = json.load(f)

        # Verify Tabs
        for tab in nav_map["tabs"]:
            component_path = tab["component"]
            # Check if file exists
            full_path = os.path.abspath(component_path)
            assert os.path.exists(
                full_path
            ), f"Navigation target missing: {component_path} for tab {tab['id']}"

    def test_main_js_handles_tabs(self):
        """
        Verify that src/static/js/main.js actually handles the tabs defined in the map.
        This is a simple text scan, not a full AST parse, but effective for regression.
        """
        map_path = os.path.join(os.path.dirname(__file__), "navigation_map.json")
        with open(map_path, "r") as f:
            nav_map = json.load(f)

        main_js_path = "src/static/js/main.js"
        with open(main_js_path, "r") as f:
            content = f.read()

        for tab in nav_map["tabs"]:
            # Check for case 'tab_id':
            expected_case = f"case '{tab['id']}':"
            assert (
                expected_case in content
            ), f"Tab '{tab['id']}' not handled in main.js switch statement"
