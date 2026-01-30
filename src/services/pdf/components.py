"""Reusable PDF components for reports."""

from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
    Image,
)
from reportlab.lib.enums import TA_CENTER

from .base import ColorPalette, format_currency, format_date


def create_header(profile_name, report_type, styles, colors_dict=None):
    """Create a simple report header.

    Args:
        profile_name: Name of the profile/client
        report_type: Type of report (e.g., "Retirement Analysis Report")
        styles: StyleSheet with custom styles
        colors_dict: Color palette to use

    Returns:
        List of flowable elements
    """
    if colors_dict is None:
        colors_dict = ColorPalette.BASIC

    elements = []
    elements.append(Paragraph(f"{report_type}", styles["ReportTitle"]))
    elements.append(Paragraph(f"Profile: {profile_name}", styles["ReportBody"]))
    elements.append(
        Paragraph(
            f"Generated: {format_date(format_str='%B %d, %Y at %I:%M %p')}",
            styles["SmallText"],
        )
    )
    elements.append(Paragraph("<i>RPS - Authored by pan</i>", styles["SmallText"]))
    elements.append(Spacer(1, 20))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=0.25,
            color=colors_dict.get("border", colors.HexColor("#bdc3c7")),
        )
    )
    elements.append(Spacer(1, 20))

    return elements


def create_cover_page(profile_name, report_type, styles, colors_dict=None):
    """Create a professional cover page.

    Args:
        profile_name: Name of the profile/client
        report_type: Type of report
        styles: StyleSheet with custom styles
        colors_dict: Color palette to use

    Returns:
        List of flowable elements (including PageBreak)
    """
    if colors_dict is None:
        colors_dict = ColorPalette.PROFESSIONAL

    elements = []

    # Add vertical space
    elements.append(Spacer(1, 2 * inch))

    # Title
    elements.append(Paragraph(report_type, styles["CoverTitle"]))
    elements.append(Spacer(1, 0.3 * inch))

    # Profile name
    elements.append(Paragraph(f"For: {profile_name}", styles["CoverSubtitle"]))
    elements.append(Spacer(1, 0.5 * inch))

    # Date
    date_str = format_date()
    elements.append(
        Paragraph(
            f"<para align=center><b>Generated:</b> {date_str}</para>",
            styles["ReportBody"],
        )
    )

    elements.append(Spacer(1, 3 * inch))

    # Footer
    elements.append(
        Paragraph(
            "<para align=center><i>Comprehensive Retirement Planning Analysis</i></para>",
            styles["SmallText"],
        )
    )
    elements.append(
        Paragraph(
            "<para align=center><i>RPS - Authored by pan</i></para>",
            styles["SmallText"],
        )
    )

    elements.append(PageBreak())
    return elements


def create_elite_cover_page(profile_name, report_type, styles, colors_dict=None):
    """Create an elite Fortune 500-style cover page.

    Args:
        profile_name: Name of the profile/client
        report_type: Type of report
        styles: StyleSheet with elite styles
        colors_dict: Color palette to use

    Returns:
        List of flowable elements (including PageBreak)
    """
    if colors_dict is None:
        colors_dict = ColorPalette.ELITE

    elements = []

    # Top spacing
    elements.append(Spacer(1, 1.5 * inch))

    # Company name/logo area
    elements.append(Paragraph("RPS", styles["CompanyName"]))
    elements.append(Paragraph("WEALTH ADVISORY", styles["CoverSubtitle"]))

    # Gold line
    elements.append(
        HRFlowable(
            width="60%",
            thickness=0.5,
            color=colors_dict.get("gold", colors.HexColor("#C79E5B")),
            spaceBefore=20,
            spaceAfter=30,
            hAlign="CENTER",
        )
    )

    elements.append(Spacer(1, 0.5 * inch))

    # Report title
    elements.append(Paragraph(report_type, styles["CoverTitle"]))
    elements.append(Spacer(1, 0.4 * inch))

    # Client box
    client_data = [
        [Paragraph(f"<b>Prepared For:</b><br/>{profile_name}", styles["BodyText"])]
    ]
    client_table = Table(client_data, colWidths=[5 * inch])
    client_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors_dict.get("bg_light", colors.HexColor("#F7F7F7")),
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.25,
                    colors_dict.get("navy", colors.HexColor("#003057")),
                ),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 25),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 25),
                ("LEFTPADDING", (0, 0), (-1, -1), 30),
                ("RIGHTPADDING", (0, 0), (-1, -1), 30),
            ]
        )
    )
    elements.append(client_table)

    elements.append(Spacer(1, 0.6 * inch))

    # Date
    date_str = format_date()
    elements.append(Paragraph(f"<b>Report Date:</b> {date_str}", styles["BodyText"]))

    elements.append(Spacer(1, 2 * inch))

    # Footer disclaimer
    disclaimer_data = [
        [
            Paragraph(
                "<i>This report contains confidential financial information and projections. "
                "It is intended solely for the use of the named client and their authorized advisors. "
                "Past performance does not guarantee future results. All projections are hypothetical.</i>",
                styles["SmallText"],
            )
        ]
    ]
    disclaimer_table = Table(disclaimer_data, colWidths=[6 * inch])
    disclaimer_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors_dict.get("bg_light", colors.HexColor("#F7F7F7")),
                ),
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.25,
                    colors_dict.get("border", colors.HexColor("#DEDEDE")),
                ),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 15),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 15),
                ("LEFTPADDING", (0, 0), (-1, -1), 25),
                ("RIGHTPADDING", (0, 0), (-1, -1), 25),
            ]
        )
    )
    elements.append(disclaimer_table)

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(
        Paragraph("RPS Wealth Advisory | Authored by pan", styles["SmallText"])
    )

    elements.append(PageBreak())
    return elements


def create_data_table(headers, data, styles, colors_dict=None, col_widths=None):
    """Create a professionally styled data table.

    Args:
        headers: List of column header strings
        data: List of row data (list of lists)
        styles: StyleSheet with custom styles
        colors_dict: Color palette to use
        col_widths: List of column widths (inches)

    Returns:
        Table flowable
    """
    if colors_dict is None:
        colors_dict = ColorPalette.BASIC

    # Prepare table data with formatted headers
    table_data = [
        [
            Paragraph(f"<b>{h}</b>", styles.get("ReportBody", styles["Normal"]))
            for h in headers
        ]
    ]

    for row in data:
        formatted_row = []
        for cell in row:
            if isinstance(cell, (int, float)):
                text = format_currency(cell)
            else:
                text = str(cell)
            formatted_row.append(
                Paragraph(text, styles.get("ReportBody", styles["Normal"]))
            )
        table_data.append(formatted_row)

    # Default column widths
    if not col_widths:
        col_widths = [6.5 * inch / len(headers)] * len(headers)
    else:
        col_widths = [w * inch for w in col_widths]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    primary_color = colors_dict.get(
        "primary", colors_dict.get("secondary", colors.HexColor("#3498db"))
    )
    border_color = colors_dict.get("border", colors.HexColor("#bdc3c7"))
    bg_color = colors_dict.get("bg_light", colors.HexColor("#ecf0f1"))
    bg_alt = colors_dict.get("bg_alt", colors.HexColor("#f8f9fa"))

    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), primary_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BACKGROUND", (0, 1), (-1, -1), bg_color),
                ("GRID", (0, 0), (-1, -1), 0.25, border_color),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, bg_alt]),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
                ("TOPPADDING", (0, 1), (-1, -1), 8),
            ]
        )
    )

    return table


def create_key_metrics_box(title, metrics_dict, styles, colors_dict=None):
    """Create a professional key metrics summary box.

    Args:
        title: Section title
        metrics_dict: Dict mapping metric labels to values
        styles: StyleSheet with custom styles
        colors_dict: Color palette to use

    Returns:
        List of flowable elements
    """
    if colors_dict is None:
        colors_dict = ColorPalette.ELITE

    elements = []

    # Title
    elements.append(
        Paragraph(title, styles.get("SectionHeader", styles.get("SectionTitle")))
    )
    elements.append(Spacer(1, 10))

    # Create metrics grid
    metrics_data = []
    row = []
    for i, (label, value) in enumerate(metrics_dict.items()):
        # Format value based on type
        if isinstance(value, (int, float)):
            if label in ["Years Projected", "Success Rate"]:
                formatted_value = f"{value:,.0f}"
            else:
                formatted_value = format_currency(value, abbreviated=True)
        else:
            formatted_value = str(value)

        cell_content = [
            [
                Paragraph(
                    f"<b>{formatted_value}</b>",
                    styles.get("LargeNumber", styles["Normal"]),
                )
            ],
            [Paragraph(label, styles["SmallText"])],
        ]
        cell_table = Table(cell_content, colWidths=[2.8 * inch])
        cell_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        row.append(cell_table)

        # Two metrics per row
        if len(row) == 2 or i == len(metrics_dict) - 1:
            metrics_data.append(row)
            row = []

    # Create main table
    metrics_table = Table(metrics_data, colWidths=[3.2 * inch, 3.2 * inch])
    primary_color = colors_dict.get(
        "navy", colors_dict.get("primary", colors.HexColor("#003057"))
    )
    border_color = colors_dict.get("border", colors.HexColor("#DEDEDE"))

    metrics_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.25, primary_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 20),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
                ("LEFTPADDING", (0, 0), (-1, -1), 15),
                ("RIGHTPADDING", (0, 0), (-1, -1), 15),
            ]
        )
    )

    elements.append(metrics_table)
    elements.append(Spacer(1, 20))

    return elements


def create_executive_summary_box(title, content, box_color, styles):
    """Create a colored box for executive summary.

    Args:
        title: Box title
        content: Box content text
        box_color: Color for box border/accent
        styles: StyleSheet with custom styles

    Returns:
        List of flowable elements
    """
    elements = []

    # Create table for colored box
    data = [
        [
            Paragraph(
                f"<b>{title}</b><br/>{content}",
                styles.get("ReportBody", styles["Normal"]),
            )
        ]
    ]

    table = Table(data, colWidths=[6.5 * inch])
    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    (
                        box_color.clone(alpha=0.1)
                        if hasattr(box_color, "clone")
                        else colors.white
                    ),
                ),
                ("BOX", (0, 0), (-1, -1), 2, box_color),
                ("LEFTPADDING", (0, 0), (-1, -1), 15),
                ("RIGHTPADDING", (0, 0), (-1, -1), 15),
                ("TOPPADDING", (0, 0), (-1, -1), 15),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 15),
            ]
        )
    )

    elements.append(table)
    elements.append(Spacer(1, 15))

    return elements


def create_disclaimer(styles):
    """Create a standard disclaimer footer.

    Args:
        styles: StyleSheet with custom styles

    Returns:
        List of flowable elements
    """
    elements = []
    elements.append(Spacer(1, 30))
    elements.append(
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#bdc3c7"))
    )
    elements.append(Spacer(1, 10))
    elements.append(
        Paragraph(
            "<i>Disclaimer: This analysis is for informational purposes only and should not be considered financial advice. "
            "Past performance does not guarantee future results. Please consult with qualified financial professionals "
            "before making retirement decisions.</i>",
            styles["SmallText"],
        )
    )
    return elements
