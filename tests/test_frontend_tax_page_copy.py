from pathlib import Path


TAX_TAB_PATH = Path("src/static/js/components/tax/tax-tab.js")


def test_tax_tab_has_no_hardcoded_conversion_example_numbers():
    """Conversion explanation text should be data-driven, not fixed dollar examples."""
    text = TAX_TAB_PATH.read_text(encoding="utf-8")
    assert "$16,359" not in text


def test_tax_tab_conversion_timeline_copy_mentions_total_plan_cost():
    """Timeline section should explicitly separate federal tax and total plan cost."""
    text = TAX_TAB_PATH.read_text(encoding="utf-8")
    assert "Total plan cost" in text
    assert "Federal conversion tax" in text
