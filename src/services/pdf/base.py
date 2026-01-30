"""Base utilities and formatters for PDF generation."""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


# Color palettes for different report styles
class ColorPalette:
    """Color palette configurations for different report styles."""

    # Basic palette (original pdf_service.py)
    BASIC = {
        "primary": colors.HexColor("#2c3e50"),
        "secondary": colors.HexColor("#3498db"),
        "accent": colors.HexColor("#34495e"),
        "success": colors.HexColor("#27ae60"),
        "warning": colors.HexColor("#e74c3c"),
        "text": colors.HexColor("#2c3e50"),
        "text_light": colors.HexColor("#7f8c8d"),
        "border": colors.HexColor("#bdc3c7"),
        "bg_light": colors.HexColor("#ecf0f1"),
        "bg_alt": colors.HexColor("#f8f9fa"),
        "white": colors.white,
    }

    # Professional palette (pdf_service_pro.py style)
    PROFESSIONAL = {
        "primary": colors.HexColor("#1a237e"),
        "secondary": colors.HexColor("#0277bd"),
        "accent": colors.HexColor("#00acc1"),
        "success": colors.HexColor("#2e7d32"),
        "warning": colors.HexColor("#f57c00"),
        "danger": colors.HexColor("#c62828"),
        "text": colors.HexColor("#212121"),
        "text_light": colors.HexColor("#757575"),
        "border": colors.HexColor("#e0e0e0"),
        "bg_light": colors.HexColor("#f5f5f5"),
        "bg_alt": colors.HexColor("#fafafa"),
        "white": colors.white,
    }

    # Elite palette (pdf_service_elite.py style - Fortune 500)
    ELITE = {
        "navy": colors.HexColor("#003057"),
        "navy_dark": colors.HexColor("#001f3f"),
        "gold": colors.HexColor("#C79E5B"),
        "gold_light": colors.HexColor("#E5D4B5"),
        "teal": colors.HexColor("#006E7F"),
        "green": colors.HexColor("#00864C"),
        "red": colors.HexColor("#C4122F"),
        "text": colors.HexColor("#4A4A4A"),
        "text_light": colors.HexColor("#757575"),
        "border": colors.HexColor("#DEDEDE"),
        "bg_light": colors.HexColor("#F7F7F7"),
        "white": colors.white,
        # Aliases for consistency
        "primary": colors.HexColor("#003057"),
        "secondary": colors.HexColor("#006E7F"),
        "success": colors.HexColor("#00864C"),
        "warning": colors.HexColor("#f57c00"),
        "danger": colors.HexColor("#C4122F"),
    }


def format_currency(value, abbreviated=False):
    """Format a number as currency.

    Args:
        value: The numeric value to format
        abbreviated: If True, use M/K abbreviations for large numbers

    Returns:
        Formatted currency string
    """
    if value is None:
        return "$0"

    if abbreviated:
        if abs(value) >= 1_000_000:
            return f"${value/1_000_000:.2f}M"
        elif abs(value) >= 1_000:
            return f"${value/1_000:.0f}K"

    return f"${value:,.0f}"


def format_percent(value, decimals=1):
    """Format a number as percentage.

    Args:
        value: The numeric value to format
        decimals: Number of decimal places

    Returns:
        Formatted percentage string
    """
    if value is None:
        return "0%"
    return f"{value:.{decimals}f}%"


def format_date(date_value=None, format_str="%B %d, %Y"):
    """Format a date for display.

    Args:
        date_value: Date to format (uses current date if None)
        format_str: strftime format string

    Returns:
        Formatted date string
    """
    if date_value is None:
        date_value = datetime.now()
    elif isinstance(date_value, str):
        date_value = datetime.fromisoformat(date_value)
    return date_value.strftime(format_str)


class NumberedCanvas(canvas.Canvas):
    """Custom canvas with professional headers and footers.

    Provides page numbering and consistent header/footer decoration.
    """

    def __init__(self, *args, **kwargs):
        self.profile_name = kwargs.pop("profile_name", "Client")
        self.report_type = kwargs.pop("report_type", "Financial Report")
        self.colors = kwargs.pop("colors", ColorPalette.ELITE)
        self.skip_first_page = kwargs.pop("skip_first_page", True)
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        """Draw professional headers and footers."""
        page_num = len(self._saved_page_states)

        # Skip decorations on cover page if configured
        if self.skip_first_page and page_num == 1:
            return

        self.saveState()

        # Header
        self.setFillColor(self.colors.get("primary", self.colors.get("navy")))
        self.setFont("Helvetica-Bold", 10)
        self.drawString(1.0 * inch, letter[1] - 0.6 * inch, "RPS Wealth Advisory")

        self.setFont("Helvetica", 9)
        self.setFillColor(self.colors.get("text_light"))
        self.drawRightString(
            letter[0] - 1.0 * inch, letter[1] - 0.6 * inch, self.report_type
        )

        # Header line
        self.setStrokeColor(self.colors.get("primary", self.colors.get("navy")))
        self.setLineWidth(0.25)
        self.line(
            1.0 * inch,
            letter[1] - 0.7 * inch,
            letter[0] - 1.0 * inch,
            letter[1] - 0.7 * inch,
        )

        # Footer
        self.setFillColor(self.colors.get("text_light"))
        self.setFont("Helvetica", 8)
        self.drawString(1.0 * inch, 0.5 * inch, "Confidential - For Client Use Only")

        date_str = format_date()
        text_width = self.stringWidth(date_str, "Helvetica", 8)
        self.drawString((letter[0] - text_width) / 2, 0.5 * inch, date_str)

        page_text = f"Page {page_num} of {page_count}"
        self.drawRightString(letter[0] - 1.0 * inch, 0.5 * inch, page_text)

        # Footer line
        self.setStrokeColor(self.colors.get("border"))
        self.setLineWidth(0.25)
        self.line(1.0 * inch, 0.7 * inch, letter[0] - 1.0 * inch, 0.7 * inch)

        self.restoreState()


def create_document(pagesize=letter, margins=None, title=None):
    """Create a standard PDF document buffer and template.

    Args:
        pagesize: Page size tuple (default: letter)
        margins: Dict with top, bottom, left, right margins (inches)
        title: Document title

    Returns:
        Tuple of (BytesIO buffer, SimpleDocTemplate)
    """
    from reportlab.platypus import SimpleDocTemplate

    buffer = io.BytesIO()

    if margins is None:
        margins = {"top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0}

    doc = SimpleDocTemplate(
        buffer,
        pagesize=pagesize,
        topMargin=margins["top"] * inch,
        bottomMargin=margins["bottom"] * inch,
        leftMargin=margins["left"] * inch,
        rightMargin=margins["right"] * inch,
        title=title or "RPS Financial Report",
    )

    return buffer, doc
