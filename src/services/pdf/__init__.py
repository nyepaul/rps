"""Consolidated PDF generation service.

This package provides PDF report generation for the RPS retirement planning system.
It consolidates functionality previously spread across multiple files.

Usage:
    from src.services.pdf import generate_analysis_report, generate_portfolio_report

    # Or import specific modules
    from src.services.pdf.base import format_currency, format_percent
    from src.services.pdf.charts import create_success_rates_chart
"""

# Base utilities
from .base import (
    ColorPalette,
    NumberedCanvas,
    format_currency,
    format_percent,
    format_date,
    create_document,
)

# Style factories
from .styles import (
    create_basic_styles,
    create_professional_styles,
    create_elite_styles,
    get_styles,
)

# Chart generation
from .charts import (
    create_success_rates_chart,
    create_portfolio_projection_chart,
    create_probability_distribution_chart,
    create_value_over_time_chart,
    create_portfolio_pie_chart,
    cleanup_chart_files,
)

# Reusable components
from .components import (
    create_header,
    create_cover_page,
    create_elite_cover_page,
    create_data_table,
    create_key_metrics_box,
    create_executive_summary_box,
    create_disclaimer,
)

# Report generators (main API)
from .reports import (
    generate_analysis_report,
    generate_elite_analysis_report,
    generate_portfolio_report,
    generate_action_plan_report,
)

# Version info for this module
__version__ = "2.0.0"
__author__ = "pan"

# Public API
__all__ = [
    # Base utilities
    "ColorPalette",
    "NumberedCanvas",
    "format_currency",
    "format_percent",
    "format_date",
    "create_document",
    # Styles
    "create_basic_styles",
    "create_professional_styles",
    "create_elite_styles",
    "get_styles",
    # Charts
    "create_success_rates_chart",
    "create_portfolio_projection_chart",
    "create_probability_distribution_chart",
    "create_value_over_time_chart",
    "create_portfolio_pie_chart",
    "cleanup_chart_files",
    # Components
    "create_header",
    "create_cover_page",
    "create_elite_cover_page",
    "create_data_table",
    "create_key_metrics_box",
    "create_executive_summary_box",
    "create_disclaimer",
    # Reports (main API)
    "generate_analysis_report",
    "generate_elite_analysis_report",
    "generate_portfolio_report",
    "generate_action_plan_report",
]
