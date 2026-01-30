"""Style configurations for PDF generation."""

from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

from .base import ColorPalette


def create_basic_styles(colors=None):
    """Create basic paragraph styles for simple reports.

    Args:
        colors: Color palette dict (defaults to ColorPalette.BASIC)

    Returns:
        StyleSheet with custom styles added
    """
    if colors is None:
        colors = ColorPalette.BASIC

    styles = getSampleStyleSheet()

    def add_style(name, **kwargs):
        if name in styles:
            return
        styles.add(ParagraphStyle(name=name, **kwargs))

    add_style(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors["primary"],
    )

    add_style(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors["secondary"],
    )

    add_style(
        "SubSection",
        parent=styles["Heading3"],
        fontSize=13,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors["accent"],
    )

    add_style(
        "ReportBody", parent=styles["Normal"], fontSize=10, spaceAfter=8, leading=14
    )

    add_style(
        "SmallText", parent=styles["Normal"], fontSize=8, textColor=colors["text_light"]
    )

    add_style(
        "Highlight",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors["success"],
        spaceBefore=5,
        spaceAfter=5,
    )

    add_style(
        "Warning",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors["warning"],
        spaceBefore=5,
        spaceAfter=5,
    )

    return styles


def create_professional_styles(colors=None):
    """Create professional paragraph styles with enhanced formatting.

    Args:
        colors: Color palette dict (defaults to ColorPalette.PROFESSIONAL)

    Returns:
        StyleSheet with custom styles added
    """
    if colors is None:
        colors = ColorPalette.PROFESSIONAL

    styles = getSampleStyleSheet()

    def add_style(name, **kwargs):
        if name in styles:
            return
        styles.add(ParagraphStyle(name=name, **kwargs))

    # Cover page title
    add_style(
        "CoverTitle",
        parent=styles["Heading1"],
        fontSize=36,
        textColor=colors["primary"],
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )

    # Cover subtitle
    add_style(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontSize=18,
        textColor=colors["secondary"],
        spaceAfter=40,
        alignment=TA_CENTER,
        fontName="Helvetica",
    )

    # Report title
    add_style(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=24,
        spaceAfter=10,
        textColor=colors["primary"],
        fontName="Helvetica-Bold",
    )

    # Section title
    add_style(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors["primary"],
        fontName="Helvetica-Bold",
    )

    # Subsection
    add_style(
        "SubSection",
        parent=styles["Heading3"],
        fontSize=13,
        spaceBefore=12,
        spaceAfter=8,
        textColor=colors["secondary"],
        fontName="Helvetica-Bold",
    )

    # Body text
    add_style(
        "ReportBody",
        parent=styles["Normal"],
        fontSize=11,
        spaceAfter=8,
        leading=16,
        alignment=TA_JUSTIFY,
        textColor=colors["text"],
    )

    # Highlight box
    add_style(
        "Highlight",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors["success"],
        spaceBefore=8,
        spaceAfter=8,
        leftIndent=20,
        rightIndent=20,
        fontName="Helvetica-Bold",
    )

    # Warning box
    add_style(
        "Warning",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors["warning"],
        spaceBefore=8,
        spaceAfter=8,
        leftIndent=20,
        rightIndent=20,
        fontName="Helvetica-Bold",
    )

    # Small text
    add_style(
        "SmallText",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors["text_light"],
        leading=12,
    )

    # Footnote
    add_style(
        "Footnote",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors["text_light"],
        alignment=TA_CENTER,
        fontStyle="italic",
    )

    return styles


def create_elite_styles(colors=None):
    """Create elite financial institution paragraph styles.

    Args:
        colors: Color palette dict (defaults to ColorPalette.ELITE)

    Returns:
        StyleSheet with custom styles added
    """
    if colors is None:
        colors = ColorPalette.ELITE

    styles = getSampleStyleSheet()

    def add_style(name, **kwargs):
        if name in styles:
            return
        styles.add(ParagraphStyle(name=name, **kwargs))

    # Cover page - Large company name
    add_style(
        "CompanyName",
        parent=styles["Normal"],
        fontSize=48,
        textColor=colors["navy"],
        spaceAfter=10,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        leading=52,
    )

    # Cover page - Report title
    add_style(
        "CoverTitle",
        parent=styles["Normal"],
        fontSize=28,
        textColor=colors["navy_dark"],
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        leading=34,
    )

    # Cover page - Subtitle
    add_style(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontSize=16,
        textColor=colors["text"],
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName="Helvetica",
        leading=20,
    )

    # Cover page - Client name
    add_style(
        "ClientName",
        parent=styles["Normal"],
        fontSize=20,
        textColor=colors["navy"],
        spaceAfter=40,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        leading=24,
    )

    # Section headers
    add_style(
        "SectionHeader",
        parent=styles["Heading1"],
        fontSize=18,
        spaceBefore=24,
        spaceAfter=14,
        textColor=colors["navy"],
        fontName="Helvetica-Bold",
        leading=22,
    )

    # Subsection headers
    add_style(
        "SubsectionHeader",
        parent=styles["Heading2"],
        fontSize=14,
        spaceBefore=16,
        spaceAfter=10,
        textColor=colors["navy"],
        fontName="Helvetica-Bold",
        leading=17,
    )

    # Body text
    add_style(
        "BodyText",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors["text"],
        spaceBefore=6,
        spaceAfter=6,
        leading=15,
        alignment=TA_JUSTIFY,
        fontName="Helvetica",
    )

    # Emphasis text
    add_style(
        "EmphasisText",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors["navy"],
        fontName="Helvetica-Bold",
        leading=15,
    )

    # Small print / footnotes
    add_style(
        "SmallText",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors["text_light"],
        leading=11,
        fontName="Helvetica",
    )

    # Key metrics - large numbers
    add_style(
        "LargeNumber",
        parent=styles["Normal"],
        fontSize=24,
        textColor=colors["navy"],
        fontName="Helvetica-Bold",
        alignment=TA_CENTER,
        leading=28,
    )

    # Aliases for compatibility
    add_style(
        "ReportTitle",
        parent=styles["Normal"],
        fontSize=24,
        spaceAfter=10,
        textColor=colors["navy"],
        fontName="Helvetica-Bold",
    )

    add_style(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors["navy"],
        fontName="Helvetica-Bold",
    )

    add_style(
        "SubSection",
        parent=styles["Heading3"],
        fontSize=13,
        spaceBefore=12,
        spaceAfter=8,
        textColor=colors["teal"],
        fontName="Helvetica-Bold",
    )

    add_style(
        "ReportBody",
        parent=styles["Normal"],
        fontSize=11,
        spaceAfter=8,
        leading=15,
        alignment=TA_JUSTIFY,
        textColor=colors["text"],
    )

    add_style(
        "Highlight",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors["green"],
        spaceBefore=8,
        spaceAfter=8,
        leftIndent=20,
        rightIndent=20,
        fontName="Helvetica-Bold",
    )

    add_style(
        "Warning",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors["red"],
        spaceBefore=8,
        spaceAfter=8,
        leftIndent=20,
        rightIndent=20,
        fontName="Helvetica-Bold",
    )

    return styles


def get_styles(style_tier="basic", colors=None):
    """Get styles for a specific tier.

    Args:
        style_tier: One of 'basic', 'professional', 'elite'
        colors: Optional custom color palette

    Returns:
        StyleSheet with appropriate styles
    """
    creators = {
        "basic": (create_basic_styles, ColorPalette.BASIC),
        "professional": (create_professional_styles, ColorPalette.PROFESSIONAL),
        "elite": (create_elite_styles, ColorPalette.ELITE),
    }

    creator, default_colors = creators.get(
        style_tier, (create_basic_styles, ColorPalette.BASIC)
    )
    return creator(colors or default_colors)
