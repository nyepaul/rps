"""Elite professional PDF generation service matching Fortune 500 financial institutions."""
import io
import os
import tempfile
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image, KeepTogether, Frame, PageTemplate
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np


# Elite Financial Institution Color Palette
# Inspired by Fidelity, Vanguard, Charles Schwab
COLORS = {
    'navy': colors.HexColor('#003057'),          # Primary navy (Fidelity-style)
    'navy_dark': colors.HexColor('#001f3f'),     # Darker navy for emphasis
    'gold': colors.HexColor('#C79E5B'),          # Gold accent (luxury touch)
    'gold_light': colors.HexColor('#E5D4B5'),    # Light gold for backgrounds
    'teal': colors.HexColor('#006E7F'),          # Accent teal
    'green': colors.HexColor('#00864C'),         # Success/positive green
    'red': colors.HexColor('#C4122F'),           # Alert/negative red
    'gray_dark': colors.HexColor('#4A4A4A'),     # Dark gray text
    'gray_medium': colors.HexColor('#757575'),   # Medium gray
    'gray_light': colors.HexColor('#DEDEDE'),    # Light gray borders
    'gray_bg': colors.HexColor('#F7F7F7'),       # Background gray
    'white': colors.white,
}


class NumberedCanvas(canvas.Canvas):
    """Custom canvas with professional headers and footers."""

    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []
        self.profile_name = kwargs.get('profile_name', 'Client')
        self.report_type = kwargs.get('report_type', 'Financial Analysis Report')

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

        # Skip decorations on cover page (page 1)
        if page_num == 1:
            return

        # Save state
        self.saveState()

        # Header - Navy bar with white text
        self.setFillColor(COLORS['navy'])
        self.rect(0, letter[1] - 0.6*inch, letter[0], 0.6*inch, fill=True, stroke=False)

        # Header text - Company name and report type
        self.setFillColor(COLORS['white'])
        self.setFont('Helvetica-Bold', 11)
        self.drawString(0.75*inch, letter[1] - 0.35*inch, "RPS Wealth Advisory")

        self.setFont('Helvetica', 9)
        self.drawRightString(letter[0] - 0.75*inch, letter[1] - 0.35*inch,
                           f"{self.report_type}")

        # Thin gold accent line under header
        self.setStrokeColor(COLORS['gold'])
        self.setLineWidth(2)
        self.line(0, letter[1] - 0.6*inch, letter[0], letter[1] - 0.6*inch)

        # Footer - Page numbers and confidentiality notice
        self.setFillColor(COLORS['gray_medium'])
        self.setFont('Helvetica', 8)

        # Left side - Confidential notice
        self.drawString(0.75*inch, 0.4*inch,
                       "Confidential - For Client Use Only")

        # Center - Date
        date_str = datetime.now().strftime("%B %d, %Y")
        text_width = self.stringWidth(date_str, 'Helvetica', 8)
        self.drawString((letter[0] - text_width) / 2, 0.4*inch, date_str)

        # Right side - Page number
        page_text = f"Page {page_num} of {page_count}"
        self.drawRightString(letter[0] - 0.75*inch, 0.4*inch, page_text)

        # Thin line above footer
        self.setStrokeColor(COLORS['gray_light'])
        self.setLineWidth(0.5)
        self.line(0.75*inch, 0.6*inch, letter[0] - 0.75*inch, 0.6*inch)

        # Restore state
        self.restoreState()


def create_elite_styles():
    """Create elite financial institution paragraph styles."""
    styles = getSampleStyleSheet()

    # Helper function to add or update style
    def add_style(name, **kwargs):
        if name in styles:
            # Style exists, don't add again
            return
        styles.add(ParagraphStyle(name=name, **kwargs))

    # Cover page - Large company name style
    add_style(
        name='CompanyName',
        parent=styles['Normal'],
        fontSize=48,
        textColor=COLORS['navy'],
        spaceAfter=10,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        leading=52
    )

    # Cover page - Report title
    add_style(
        name='CoverTitle',
        parent=styles['Normal'],
        fontSize=28,
        textColor=COLORS['navy_dark'],
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        leading=34
    )

    # Cover page - Subtitle
    add_style(
        name='CoverSubtitle',
        parent=styles['Normal'],
        fontSize=16,
        textColor=COLORS['gray_dark'],
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica',
        leading=20
    )

    # Cover page - Client name (emphasized)
    add_style(
        name='ClientName',
        parent=styles['Normal'],
        fontSize=20,
        textColor=COLORS['navy'],
        spaceAfter=40,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        leading=24
    )

    # Section headers with navy color
    add_style(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=18,
        spaceBefore=24,
        spaceAfter=14,
        textColor=COLORS['navy'],
        fontName='Helvetica-Bold',
        borderWidth=0,
        borderColor=COLORS['navy'],
        borderPadding=0,
        leftIndent=0,
        leading=22
    )

    # Subsection headers
    add_style(
        name='SubsectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=16,
        spaceAfter=10,
        textColor=COLORS['navy'],
        fontName='Helvetica-Bold',
        leading=17
    )

    # Body text - professional and readable
    add_style(
        name='BodyText',
        parent=styles['Normal'],
        fontSize=11,
        textColor=COLORS['gray_dark'],
        spaceBefore=6,
        spaceAfter=6,
        leading=15,
        alignment=TA_JUSTIFY,
        fontName='Helvetica'
    )

    # Emphasis text
    add_style(
        name='EmphasisText',
        parent=styles['Normal'],
        fontSize=11,
        textColor=COLORS['navy'],
        fontName='Helvetica-Bold',
        leading=15
    )

    # Small print / footnotes
    add_style(
        name='SmallText',
        parent=styles['Normal'],
        fontSize=9,
        textColor=COLORS['gray_medium'],
        leading=11,
        fontName='Helvetica'
    )

    # Key metrics - large numbers
    add_style(
        name='LargeNumber',
        parent=styles['Normal'],
        fontSize=24,
        textColor=COLORS['navy'],
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
        leading=28
    )

    return styles


def create_professional_cover_page(profile_name, report_type, styles):
    """Create an elite cover page matching Fortune 500 financial institutions."""
    elements = []

    # Top spacing
    elements.append(Spacer(1, 1.5*inch))

    # Company name/logo area
    elements.append(Paragraph("RPS", styles['CompanyName']))
    elements.append(Paragraph("WEALTH ADVISORY", styles['CoverSubtitle']))

    # Horizontal gold line
    elements.append(HRFlowable(
        width="60%",
        thickness=2,
        color=COLORS['gold'],
        spaceBefore=20,
        spaceAfter=30,
        hAlign='CENTER'
    ))

    elements.append(Spacer(1, 0.5*inch))

    # Report title
    elements.append(Paragraph(report_type, styles['CoverTitle']))
    elements.append(Spacer(1, 0.4*inch))

    # Client name in box
    client_data = [[Paragraph(f"<b>Prepared For:</b><br/>{profile_name}", styles['BodyText'])]]
    client_table = Table(client_data, colWidths=[5*inch])
    client_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['gray_bg']),
        ('BOX', (0, 0), (-1, -1), 1.5, COLORS['navy']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
    ]))
    elements.append(client_table)

    elements.append(Spacer(1, 0.6*inch))

    # Date
    date_str = datetime.now().strftime("%B %d, %Y")
    elements.append(Paragraph(f"<b>Report Date:</b> {date_str}", styles['BodyText']))

    elements.append(Spacer(1, 2*inch))

    # Footer disclaimer
    disclaimer_data = [[Paragraph(
        "<i>This report contains confidential financial information and projections. "
        "It is intended solely for the use of the named client and their authorized advisors. "
        "Past performance does not guarantee future results. All projections are hypothetical.</i>",
        styles['SmallText']
    )]]
    disclaimer_table = Table(disclaimer_data, colWidths=[6*inch])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['gray_bg']),
        ('BOX', (0, 0), (-1, -1), 0.5, COLORS['gray_light']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(disclaimer_table)

    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(
        "RPS Wealth Advisory | Authored by pan",
        styles['SmallText']
    ))

    elements.append(PageBreak())
    return elements


def create_key_metrics_box(title, metrics_dict, styles):
    """Create a professional key metrics summary box."""
    elements = []

    # Title
    elements.append(Paragraph(title, styles['SectionHeader']))
    elements.append(Spacer(1, 10))

    # Create metrics grid
    metrics_data = []
    row = []
    for i, (label, value) in enumerate(metrics_dict.items()):
        # Format value based on type
        if isinstance(value, (int, float)):
            if value >= 1000000:
                formatted_value = f"${value/1000000:.2f}M"
            elif value >= 1000:
                formatted_value = f"${value/1000:.1f}K"
            else:
                formatted_value = f"${value:,.0f}"
        else:
            formatted_value = str(value)

        cell_content = [
            [Paragraph(f"<b>{formatted_value}</b>", styles['LargeNumber'])],
            [Paragraph(label, styles['SmallText'])]
        ]
        cell_table = Table(cell_content, colWidths=[2.8*inch])
        cell_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))

        row.append(cell_table)

        # Two metrics per row
        if len(row) == 2 or i == len(metrics_dict) - 1:
            metrics_data.append(row)
            row = []

    # Create main table
    metrics_table = Table(metrics_data, colWidths=[3.2*inch, 3.2*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLORS['gray_bg']),
        ('BOX', (0, 0), (-1, -1), 1.5, COLORS['navy']),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, COLORS['gray_light']),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))

    elements.append(metrics_table)
    elements.append(Spacer(1, 20))

    return elements


def create_professional_table(headers, data, styles, col_widths=None):
    """Create a professionally styled table."""
    # Prepare table data with headers
    table_data = [[Paragraph(f"<b>{h}</b>", styles['EmphasisText']) for h in headers]]

    for row in data:
        formatted_row = []
        for cell in row:
            if isinstance(cell, (int, float)):
                if abs(cell) >= 1000000:
                    text = f"${cell/1000000:.2f}M"
                elif abs(cell) >= 1000:
                    text = f"${cell/1000:,.0f}K"
                else:
                    text = f"${cell:,.0f}"
            elif isinstance(cell, str) and '%' in cell:
                text = cell
            else:
                text = str(cell)
            formatted_row.append(Paragraph(text, styles['BodyText']))
        table_data.append(formatted_row)

    # Default column widths if not provided
    if not col_widths:
        col_widths = [6.5*inch / len(headers)] * len(headers)

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header row styling
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['navy']),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLORS['white']),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),

        # Data rows styling
        ('BACKGROUND', (0, 1), (-1, -1), COLORS['white']),
        ('TEXTCOLOR', (0, 1), (-1, -1), COLORS['gray_dark']),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 1), (-1, -1), 'LEFT'),

        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLORS['white'], COLORS['gray_bg']]),

        # Grid and borders
        ('GRID', (0, 0), (-1, -1), 0.5, COLORS['gray_light']),
        ('BOX', (0, 0), (-1, -1), 1.5, COLORS['navy']),

        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),

        # Alignment
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    return table


def create_elite_chart(data_dict, chart_type='line', title='', xlabel='', ylabel='', figsize=(8, 5)):
    """Create professional charts with elite styling."""
    # Set professional style
    plt.style.use('seaborn-v0_8-darkgrid')

    fig, ax = plt.subplots(figsize=figsize, facecolor='white')

    # Navy and gold color scheme
    colors_list = [
        '#003057',  # Navy
        '#006E7F',  # Teal
        '#00864C',  # Green
        '#C79E5B',  # Gold
        '#C4122F',  # Red
    ]

    if chart_type == 'line':
        for i, (label, values) in enumerate(data_dict.items()):
            ax.plot(values, label=label, linewidth=2.5, color=colors_list[i % len(colors_list)])
    elif chart_type == 'bar':
        x = np.arange(len(next(iter(data_dict.values()))))
        width = 0.8 / len(data_dict)
        for i, (label, values) in enumerate(data_dict.items()):
            ax.bar(x + i*width, values, width, label=label, color=colors_list[i % len(colors_list)])

    # Styling
    ax.set_title(title, fontsize=14, fontweight='bold', color='#003057', pad=15)
    ax.set_xlabel(xlabel, fontsize=11, color='#4A4A4A')
    ax.set_ylabel(ylabel, fontsize=11, color='#4A4A4A')

    # Grid styling
    ax.grid(True, linestyle='--', alpha=0.3, color='#DEDEDE')
    ax.set_facecolor('#FAFAFA')

    # Legend
    if len(data_dict) > 1:
        ax.legend(loc='best', frameon=True, fancybox=True, shadow=True,
                 framealpha=0.95, fontsize=10)

    # Remove top and right spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#DEDEDE')
    ax.spines['bottom'].set_color('#DEDEDE')

    plt.tight_layout()

    # Save to temp file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png', dir=tempfile.gettempdir())
    plt.savefig(temp_file.name, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()

    return temp_file.name


def generate_elite_analysis_report(profile_data, analysis_results):
    """Generate elite professional analysis report."""
    buffer = io.BytesIO()

    profile_name = profile_data.get('name', 'Client')
    report_type = "Comprehensive Retirement Analysis"

    # Create document with custom canvas
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=1.0*inch,
        bottomMargin=0.9*inch,
        title=f"{report_type} - {profile_name}"
    )

    styles = create_elite_styles()
    elements = []
    temp_files = []

    # Cover page
    elements.extend(create_professional_cover_page(profile_name, report_type, styles))

    # Executive Summary
    elements.append(Paragraph("Executive Summary", styles['SectionHeader']))
    elements.append(HRFlowable(
        width="100%",
        thickness=2,
        color=COLORS['navy'],
        spaceBefore=5,
        spaceAfter=15
    ))

    total_assets = analysis_results.get('total_assets', 0)
    scenarios = analysis_results.get('scenarios', {})

    summary_text = (
        f"This comprehensive retirement analysis presents Monte Carlo simulations across multiple "
        f"asset allocation scenarios. Based on current assets of <b>${total_assets:,.0f}</b>, "
        f"we have modeled {analysis_results.get('simulations', 1000):,} simulations over "
        f"{analysis_results.get('years_projected', 30)} years to project potential outcomes."
    )
    elements.append(Paragraph(summary_text, styles['BodyText']))
    elements.append(Spacer(1, 20))

    # Key Metrics
    if scenarios:
        moderate_scenario = scenarios.get('moderate', {})
        metrics = {
            'Total Assets': total_assets,
            'Success Rate': f"{moderate_scenario.get('success_rate', 0):.1f}%",
            'Median Outcome': moderate_scenario.get('median_final_value', 0),
            'Years Projected': analysis_results.get('years_projected', 30)
        }
        elements.extend(create_key_metrics_box("Key Metrics", metrics, styles))

    # Scenario Analysis
    elements.append(PageBreak())
    elements.append(Paragraph("Scenario Analysis", styles['SectionHeader']))
    elements.append(HRFlowable(
        width="100%",
        thickness=2,
        color=COLORS['navy'],
        spaceBefore=5,
        spaceAfter=15
    ))

    scenario_data = []
    for scenario_key, scenario_result in scenarios.items():
        scenario_name = scenario_result.get('scenario_name', scenario_key.title())
        success_rate = scenario_result.get('success_rate', 0)
        median_value = scenario_result.get('median_final_value', 0)
        percentile_10 = scenario_result.get('percentile_10', 0)
        percentile_90 = scenario_result.get('percentile_90', 0)

        scenario_data.append([
            scenario_name,
            f"{success_rate:.1f}%",
            median_value,
            percentile_10,
            percentile_90
        ])

    if scenario_data:
        headers = ['Scenario', 'Success Rate', 'Median Final', '10th Percentile', '90th Percentile']
        scenario_table = create_professional_table(
            headers,
            scenario_data,
            styles,
            col_widths=[1.5*inch, 1.2*inch, 1.3*inch, 1.4*inch, 1.4*inch]
        )
        elements.append(scenario_table)

    # Build PDF with custom canvas
    doc.build(
        elements,
        canvasmaker=lambda *args, **kwargs: NumberedCanvas(
            *args,
            **kwargs,
            profile_name=profile_name,
            report_type=report_type
        )
    )

    # Cleanup temp files
    for temp_file in temp_files:
        try:
            os.unlink(temp_file)
        except:
            pass

    buffer.seek(0)
    return buffer
