"""Wells Fargo-style comprehensive financial statement generator."""
import io
import os
import tempfile
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np


# Wells Fargo-inspired color scheme
STATEMENT_COLORS = {
    'wells_red': colors.HexColor('#D71E28'),       # Wells Fargo red
    'wells_gold': colors.HexColor('#FFCD41'),      # Wells Fargo gold
    'navy': colors.HexColor('#003057'),            # Navy blue
    'dark_gray': colors.HexColor('#4A4A4A'),
    'medium_gray': colors.HexColor('#757575'),
    'light_gray': colors.HexColor('#DEDEDE'),
    'bg_gray': colors.HexColor('#F7F7F7'),
    'black': colors.black,
    'white': colors.white,
}


class StatementCanvas(canvas.Canvas):
    """Custom canvas for Wells Fargo-style statement with professional headers/footers."""

    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []
        self.account_name = kwargs.get('account_name', 'Account Holder')
        self.account_number = kwargs.get('account_number', 'XXXX-XXXX')
        self.statement_period = kwargs.get('statement_period', datetime.now().strftime("%B %Y"))

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
        """Draw headers and footers matching Wells Fargo style."""
        page_num = len(self._saved_page_states)

        # Skip on cover page
        if page_num == 1:
            return

        self.saveState()

        # Header section - professional and clean
        self.setFillColor(STATEMENT_COLORS['navy'])
        self.setFont('Helvetica-Bold', 11)
        self.drawString(1.0*inch, letter[1] - 0.5*inch, "COMBINED SNAPSHOT")

        self.setFont('Helvetica', 9)
        self.drawRightString(letter[0] - 1.0*inch, letter[1] - 0.5*inch, self.account_name)

        self.setFont('Helvetica', 8)
        self.setFillColor(STATEMENT_COLORS['medium_gray'])
        self.drawRightString(letter[0] - 1.0*inch, letter[1] - 0.65*inch,
                           f"Current period ending {self.statement_period}")

        # Sharp header line
        self.setStrokeColor(STATEMENT_COLORS['black'])
        self.setLineWidth(0.5)
        self.line(1.0*inch, letter[1] - 0.75*inch, letter[0] - 1.0*inch, letter[1] - 0.75*inch)

        # Footer section
        self.setFillColor(STATEMENT_COLORS['medium_gray'])
        self.setFont('Helvetica', 7)

        # Left - Confidentiality notice
        self.drawString(1.0*inch, 0.6*inch, "Investment and Insurance Products are:")
        self.drawString(1.0*inch, 0.5*inch, "• Not Insured by the FDIC or Any Federal Government Agency")
        self.drawString(1.0*inch, 0.4*inch, "• Subject to Investment Risks, Including Possible Loss of Principal Amount Invested")

        # Right - Page number
        self.setFont('Helvetica-Bold', 8)
        self.drawRightString(letter[0] - 1.0*inch, 0.5*inch, f"Page {page_num} of {page_count}")

        # Footer line
        self.setStrokeColor(STATEMENT_COLORS['light_gray'])
        self.setLineWidth(0.25)
        self.line(1.0*inch, 0.35*inch, letter[0] - 1.0*inch, 0.35*inch)

        # RPS branding at bottom
        self.setFont('Helvetica', 7)
        self.setFillColor(STATEMENT_COLORS['medium_gray'])
        self.drawString(1.0*inch, 0.25*inch, "RPS Wealth Advisory | Retirement Planning System")

        self.restoreState()


def create_value_over_time_chart(monthly_values, width=5.5, height=2.5):
    """Create a professional value over time chart like Wells Fargo."""
    fig, ax = plt.subplots(figsize=(width, height))

    # Prepare data
    months = list(range(1, 13))
    if len(monthly_values) < 12:
        monthly_values.extend([monthly_values[-1]] * (12 - len(monthly_values)))

    # Plot with professional styling
    ax.plot(months, monthly_values[:12], linewidth=2, color='#003057')
    ax.fill_between(months, monthly_values[:12], alpha=0.1, color='#003057')

    # Formatting
    ax.set_xlabel('Month', fontsize=8, fontweight='bold')
    ax.set_ylabel('Portfolio Value ($)', fontsize=8, fontweight='bold')
    ax.set_title('Value over time', fontsize=10, fontweight='bold', loc='left')

    # Grid styling
    ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#DEDEDE')
    ax.spines['bottom'].set_color('#DEDEDE')

    # Format y-axis as currency
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
    ax.tick_params(labelsize=8)

    plt.tight_layout()

    # Save to buffer
    img_buffer = io.BytesIO()
    plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
    img_buffer.seek(0)
    plt.close()

    return img_buffer


def create_portfolio_pie_chart(asset_allocation, width=3, height=3):
    """Create a portfolio allocation pie chart."""
    fig, ax = plt.subplots(figsize=(width, height))

    labels = list(asset_allocation.keys())
    sizes = list(asset_allocation.values())
    colors_list = ['#003057', '#757575', '#DEDEDE', '#C79E5B', '#006E7F']

    # Create pie chart
    wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%',
                                        colors=colors_list[:len(labels)],
                                        startangle=90, textprops={'fontsize': 8})

    # Make percentage text white and bold
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
        autotext.set_fontsize(9)

    ax.set_title('Current Portfolio', fontsize=10, fontweight='bold', pad=10)
    plt.tight_layout()

    # Save to buffer
    img_buffer = io.BytesIO()
    plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
    img_buffer.seek(0)
    plt.close()

    return img_buffer


def generate_comprehensive_statement(profile_data, analysis_results=None):
    """Generate a comprehensive Wells Fargo-style financial statement."""
    buffer = io.BytesIO()

    # Document setup
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=1.0*inch,
        bottomMargin=0.85*inch,
        leftMargin=1.0*inch,
        rightMargin=1.0*inch
    )

    # Get profile info
    profile_name = profile_data.get('name', 'Account Holder')
    account_number = profile_data.get('account_number', 'XXXX-XXXX')
    statement_date = datetime.now().strftime("%B %d, %Y")
    statement_period = datetime.now().strftime("%B %Y")

    # Custom canvas
    def on_page(canvas_obj, doc_obj):
        pass  # Handled by StatementCanvas

    # Styles
    styles = getSampleStyleSheet()

    # Custom styles matching Wells Fargo
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=STATEMENT_COLORS['navy'],
        spaceAfter=6,
        fontName='Helvetica-Bold',
        alignment=TA_LEFT
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=STATEMENT_COLORS['navy'],
        spaceAfter=8,
        spaceBefore=12,
        fontName='Helvetica-Bold'
    )

    subheading_style = ParagraphStyle(
        'CustomSubheading',
        parent=styles['Heading3'],
        fontSize=10,
        textColor=STATEMENT_COLORS['navy'],
        spaceAfter=6,
        fontName='Helvetica-Bold'
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=9,
        textColor=STATEMENT_COLORS['dark_gray'],
        spaceAfter=6,
        fontName='Helvetica'
    )

    small_text_style = ParagraphStyle(
        'SmallText',
        parent=styles['Normal'],
        fontSize=7,
        textColor=STATEMENT_COLORS['medium_gray'],
        fontName='Helvetica'
    )

    # Story (content elements)
    story = []

    # ============= COVER PAGE =============
    story.append(Spacer(1, 0.25*inch))

    # Logo/Header area
    story.append(Paragraph("RPS WEALTH ADVISORY", title_style))
    story.append(Spacer(1, 0.05*inch))
    story.append(HRFlowable(width="100%", thickness=2, color=STATEMENT_COLORS['navy']))
    story.append(Spacer(1, 0.3*inch))

    # Main title
    cover_title_style = ParagraphStyle(
        'CoverTitle',
        parent=title_style,
        fontSize=28,
        alignment=TA_CENTER,
        spaceBefore=0,
        spaceAfter=12
    )
    story.append(Paragraph("COMBINED SNAPSHOT", cover_title_style))
    story.append(Paragraph(f"Current period ending {statement_period}",
                          ParagraphStyle('Subtitle', parent=body_style, alignment=TA_CENTER, fontSize=11)))

    story.append(Spacer(1, 0.4*inch))

    # Account information box
    financial_data = profile_data.get('financial', {})
    assets_data = profile_data.get('assets', {})

    # Calculate total value
    retirement_value = sum(a.get('value', 0) for a in assets_data.get('retirement_accounts', []))
    taxable_value = sum(a.get('value', 0) for a in assets_data.get('taxable_accounts', []))
    total_value = retirement_value + taxable_value

    # Previous value (simulate 1-month change)
    previous_value = total_value * 0.98  # Assume 2% growth
    net_change = total_value - previous_value

    account_info_data = [
        ['PRIMARY ACCOUNT NAME:', profile_name.upper()],
        ['PRIMARY ACCOUNT NUMBER:', account_number],
        ['', ''],
        ['Your Financial Advisor:', ''],
        ['RPS Wealth Advisory', 'Electronic Delivery'],
        ['Email: support@rpswealth.com', f'Statement Date: {statement_date}'],
    ]

    account_table = Table(account_info_data, colWidths=[3*inch, 3.5*inch])
    account_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 9),
        ('FONT', (0, 0), (0, 1), 'Helvetica-Bold', 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), STATEMENT_COLORS['dark_gray']),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(account_table)

    story.append(Spacer(1, 0.4*inch))

    # Summary box with shading
    summary_data = [
        ['PREVIOUS VALUE', 'NET CHANGE', 'CURRENT VALUE'],
        [f'${previous_value:,.2f}', f'${net_change:,.2f}', f'${total_value:,.2f}'],
    ]

    summary_table = Table(summary_data, colWidths=[2.1*inch, 2.1*inch, 2.3*inch])
    summary_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), STATEMENT_COLORS['navy']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        # Value row
        ('BACKGROUND', (0, 1), (-1, 1), STATEMENT_COLORS['bg_gray']),
        ('FONT', (0, 1), (-1, 1), 'Helvetica-Bold', 14),
        ('TEXTCOLOR', (0, 1), (-1, 1), STATEMENT_COLORS['navy']),
        ('ALIGN', (0, 1), (-1, 1), 'CENTER'),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 12),
        ('TOPPADDING', (0, 1), (-1, 1), 12),
        # Borders
        ('BOX', (0, 0), (-1, -1), 1, STATEMENT_COLORS['navy']),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, STATEMENT_COLORS['light_gray']),
    ]))
    story.append(summary_table)

    story.append(Spacer(1, 0.3*inch))

    # Important notice box
    notice_text = """<b>IMPORTANT NOTICE:</b> This statement contains important information about your
    retirement and investment accounts. Please review carefully and report any discrepancies within 10 days."""

    story.append(Paragraph(notice_text, ParagraphStyle(
        'Notice',
        parent=body_style,
        fontSize=8,
        textColor=STATEMENT_COLORS['dark_gray'],
        borderColor=STATEMENT_COLORS['light_gray'],
        borderWidth=1,
        borderPadding=10,
        backColor=STATEMENT_COLORS['bg_gray']
    )))

    story.append(Spacer(1, 0.3*inch))

    # Disclaimer box
    disclaimer = """<b>Investment and Insurance Products are:</b><br/>
    • Not Insured by the FDIC or Any Federal Government Agency<br/>
    • Not a Deposit or Other Obligation of, or Guaranteed by, the Bank or Any Bank Affiliate<br/>
    • Subject to Investment Risks, Including Possible Loss of the Principal Amount Invested"""

    story.append(Paragraph(disclaimer, ParagraphStyle(
        'Disclaimer',
        parent=small_text_style,
        fontSize=7,
        borderColor=STATEMENT_COLORS['black'],
        borderWidth=1,
        borderPadding=8
    )))

    story.append(PageBreak())

    # ============= PAGE 2: COMBINED SNAPSHOT SUMMARY =============
    story.append(Paragraph("COMBINED SNAPSHOT", heading_style))
    story.append(Paragraph(f"{profile_name.upper()}", subheading_style))
    story.append(Paragraph(f"Period: {statement_period}", body_style))
    story.append(Spacer(1, 0.2*inch))

    # Progress summary table
    story.append(Paragraph("Progress summary", subheading_style))

    progress_data = [
        ['', 'THIS PERIOD', 'THIS YEAR'],
        ['Opening value', f'${previous_value:,.2f}', f'${previous_value:,.2f}'],
        ['Cash deposited', '$0.00', '$0.00'],
        ['Cash withdrawn', '$0.00', '$0.00'],
        ['Change in value', f'${net_change:,.2f}', f'${net_change:,.2f}'],
        ['Closing value', f'${total_value:,.2f}', f'${total_value:,.2f}'],
    ]

    progress_table = Table(progress_data, colWidths=[2.5*inch, 2*inch, 2*inch])
    progress_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
        ('FONT', (0, 1), (0, -1), 'Helvetica', 9),
        ('FONT', (1, 1), (-1, -1), 'Helvetica', 9),
        ('FONT', (0, -1), (-1, -1), 'Helvetica-Bold', 10),
        ('BACKGROUND', (0, 0), (-1, 0), STATEMENT_COLORS['bg_gray']),
        ('BACKGROUND', (0, -1), (-1, -1), STATEMENT_COLORS['bg_gray']),
        ('TEXTCOLOR', (0, 0), (-1, -1), STATEMENT_COLORS['dark_gray']),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, STATEMENT_COLORS['light_gray']),
        ('LINEBELOW', (0, 0), (-1, 0), 1, STATEMENT_COLORS['navy']),
    ]))
    story.append(progress_table)

    story.append(Spacer(1, 0.3*inch))

    # Value over time chart
    story.append(Paragraph("Value over time", subheading_style))

    # Generate monthly values (simulate growth)
    monthly_values = [previous_value * (1 + (i * 0.01)) for i in range(12)]
    monthly_values[-1] = total_value  # Current value

    chart_buffer = create_value_over_time_chart(monthly_values)
    chart_img = Image(chart_buffer, width=5.5*inch, height=2.5*inch)
    story.append(chart_img)

    story.append(Spacer(1, 0.3*inch))

    # Portfolio summary with pie chart
    story.append(Paragraph("Combined portfolio summary", subheading_style))

    # Calculate asset allocation
    cash_value = sum(a.get('value', 0) for a in assets_data.get('taxable_accounts', [])
                     if 'savings' in a.get('type', '').lower() or 'cash' in a.get('type', '').lower())
    stocks_value = retirement_value * 0.6  # Assume 60% stocks
    bonds_value = retirement_value * 0.3   # Assume 30% bonds
    other_value = total_value - cash_value - stocks_value - bonds_value

    asset_types = [
        ('Cash and sweep balances', cash_value),
        ('Stocks, options & ETFs', stocks_value),
        ('Fixed income securities', bonds_value),
        ('Other investments', other_value),
    ]

    portfolio_data = [
        ['ASSET TYPE', 'CURRENT VALUE', '%', 'EST. ANN. INCOME'],
    ]

    for asset_name, asset_value in asset_types:
        pct = (asset_value / total_value * 100) if total_value > 0 else 0
        ann_income = asset_value * 0.02  # Assume 2% yield
        portfolio_data.append([
            asset_name,
            f'${asset_value:,.2f}',
            f'{pct:.1f}%',
            f'${ann_income:,.0f}'
        ])

    portfolio_data.append([
        'Asset value',
        f'${total_value:,.2f}',
        '100%',
        f'${total_value * 0.02:,.0f}'
    ])

    portfolio_table = Table(portfolio_data, colWidths=[2.5*inch, 1.8*inch, 0.8*inch, 1.4*inch])
    portfolio_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
        ('FONT', (0, 1), (-1, -2), 'Helvetica', 9),
        ('FONT', (0, -1), (-1, -1), 'Helvetica-Bold', 10),
        ('BACKGROUND', (0, 0), (-1, 0), STATEMENT_COLORS['navy']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), STATEMENT_COLORS['bg_gray']),
        ('TEXTCOLOR', (0, 1), (-1, -1), STATEMENT_COLORS['dark_gray']),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, STATEMENT_COLORS['light_gray']),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.white),
    ]))
    story.append(portfolio_table)

    # Add pie chart
    story.append(Spacer(1, 0.2*inch))
    asset_allocation = {name: val for name, val in asset_types if val > 0}
    if asset_allocation:
        pie_buffer = create_portfolio_pie_chart(asset_allocation)
        pie_img = Image(pie_buffer, width=3*inch, height=3*inch)
        story.append(pie_img)

    story.append(PageBreak())

    # ============= PAGE 3: ACCOUNT DETAILS =============
    story.append(Paragraph("Account Details", heading_style))
    story.append(Spacer(1, 0.1*inch))

    # Retirement accounts
    if assets_data.get('retirement_accounts'):
        story.append(Paragraph("Retirement Accounts", subheading_style))

        for account in assets_data.get('retirement_accounts', []):
            account_name = account.get('name', 'Retirement Account')
            account_type = account.get('type', 'IRA').upper()
            account_value = account.get('value', 0)

            acct_data = [
                [f"{account_type} - {account_name}", f'${account_value:,.2f}'],
            ]

            acct_table = Table(acct_data, colWidths=[4.5*inch, 2*inch])
            acct_table.setStyle(TableStyle([
                ('FONT', (0, 0), (0, 0), 'Helvetica-Bold', 10),
                ('FONT', (1, 0), (1, 0), 'Helvetica-Bold', 11),
                ('TEXTCOLOR', (0, 0), (-1, -1), STATEMENT_COLORS['navy']),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('LINEBELOW', (0, 0), (-1, 0), 1, STATEMENT_COLORS['navy']),
            ]))
            story.append(acct_table)
            story.append(Spacer(1, 0.1*inch))

    # Taxable accounts
    if assets_data.get('taxable_accounts'):
        story.append(Paragraph("Taxable Accounts", subheading_style))

        for account in assets_data.get('taxable_accounts', []):
            account_name = account.get('name', 'Taxable Account')
            account_type = account.get('type', 'Brokerage').upper()
            account_value = account.get('value', 0)

            acct_data = [
                [f"{account_type} - {account_name}", f'${account_value:,.2f}'],
            ]

            acct_table = Table(acct_data, colWidths=[4.5*inch, 2*inch])
            acct_table.setStyle(TableStyle([
                ('FONT', (0, 0), (0, 0), 'Helvetica-Bold', 10),
                ('FONT', (1, 0), (1, 0), 'Helvetica-Bold', 11),
                ('TEXTCOLOR', (0, 0), (-1, -1), STATEMENT_COLORS['navy']),
                ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('LINEBELOW', (0, 0), (-1, 0), 1, STATEMENT_COLORS['navy']),
            ]))
            story.append(acct_table)
            story.append(Spacer(1, 0.1*inch))

    story.append(Spacer(1, 0.3*inch))

    # Account profile information
    story.append(Paragraph("Your Account Profile", subheading_style))

    profile_info_data = [
        ['Full account name:', profile_name],
        ['Account type:', 'Combined Investment Accounts'],
        ['Tax status:', 'Mixed (Taxable & Tax-Deferred)'],
        ['Investment objective:', 'Growth & Income'],
        ['Risk tolerance:', 'Moderate'],
        ['Time horizon:', 'Long-term (10+ years)'],
    ]

    profile_table = Table(profile_info_data, colWidths=[2.5*inch, 4*inch])
    profile_table.setStyle(TableStyle([
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 9),
        ('FONT', (1, 0), (1, -1), 'Helvetica', 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), STATEMENT_COLORS['dark_gray']),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, STATEMENT_COLORS['light_gray']),
    ]))
    story.append(profile_table)

    story.append(Spacer(1, 0.3*inch))

    # Important disclosures
    story.append(Paragraph("Important Disclosures", subheading_style))

    disclosures_text = """
    <b>About your statement:</b> This account statement contains important information about your
    investment accounts. All account statements shall be deemed complete and accurate if not objected
    to in writing within ten days of receipt. We encourage you to review the details in this statement.<br/><br/>

    <b>Securities pricing:</b> Securities prices on your statement may vary from actual liquidation value.
    Prices are provided by outside quotation services which we believe are reliable but due to the nature
    of market data the accuracy cannot be guaranteed.<br/><br/>

    <b>Account protection:</b> RPS Wealth Advisory maintains insurance coverage for client accounts.
    For more information about account protection, please contact your financial advisor.<br/><br/>

    <b>Investment objectives:</b> Please inform us promptly of any material change that might affect
    your investment objectives, risk tolerances, or financial situation.
    """

    story.append(Paragraph(disclosures_text, ParagraphStyle(
        'Disclosures',
        parent=small_text_style,
        fontSize=7,
        leading=9,
        textColor=STATEMENT_COLORS['dark_gray']
    )))

    # Build PDF with custom canvas
    doc.build(story, canvasmaker=lambda *args, **kwargs: StatementCanvas(
        *args,
        account_name=profile_name,
        account_number=account_number,
        statement_period=statement_period,
        **kwargs
    ))

    buffer.seek(0)
    return buffer


def generate_statement_report(profile_data, analysis_results=None):
    """Main entry point for generating Wells Fargo-style statement."""
    return generate_comprehensive_statement(profile_data, analysis_results)
