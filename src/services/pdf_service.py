"""PDF generation service using ReportLab."""
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def create_styles():
    """Create custom paragraph styles."""
    styles = getSampleStyleSheet()

    # Helper function to add or update style
    def add_style(name, **kwargs):
        if name in styles:
            # Style exists, don't add again
            return
        styles.add(ParagraphStyle(name=name, **kwargs))

    add_style(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#2c3e50')
    )

    add_style(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#3498db')
    )

    add_style(
        'SubSection',
        parent=styles['Heading3'],
        fontSize=13,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors.HexColor('#34495e')
    )

    add_style(
        'ReportBody',  # Renamed to avoid conflict with default BodyText
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=8,
        leading=14
    )

    add_style(
        'SmallText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#7f8c8d')
    )

    add_style(
        'Highlight',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#27ae60'),
        spaceBefore=5,
        spaceAfter=5
    )

    add_style(
        'Warning',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#e74c3c'),
        spaceBefore=5,
        spaceAfter=5
    )

    return styles


def format_currency(value):
    """Format a number as currency."""
    if value is None:
        return '$0'
    return f"${value:,.0f}"


def format_percent(value):
    """Format a number as percentage."""
    if value is None:
        return '0%'
    return f"{value:.1f}%"


def create_header(profile_name, report_type):
    """Create report header elements."""
    styles = create_styles()
    elements = []

    elements.append(Paragraph(f"{report_type}", styles['ReportTitle']))
    elements.append(Paragraph(f"Profile: {profile_name}", styles['ReportBody']))
    elements.append(Paragraph(
        f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
        styles['SmallText']
    ))
    elements.append(Paragraph(
        "<i>RPS - Authored by pan</i>",
        styles['SmallText']
    ))
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#bdc3c7')))
    elements.append(Spacer(1, 20))

    return elements


def generate_analysis_report(profile_data, analysis_results):
    """Generate Monte Carlo analysis PDF report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    styles = create_styles()
    elements = []

    # Header
    profile_name = profile_data.get('name', 'Unnamed Profile')
    elements.extend(create_header(profile_name, "Retirement Analysis Report"))

    # Executive Summary
    elements.append(Paragraph("Executive Summary", styles['SectionTitle']))

    scenarios = analysis_results.get('scenarios', {})
    moderate = scenarios.get('moderate', {})
    success_rate = moderate.get('success_rate', 0)

    if success_rate >= 90:
        summary_text = f"Your retirement plan shows a <b>{format_percent(success_rate)}</b> success rate under moderate market conditions. This is an excellent result indicating a high probability of meeting your retirement goals."
        elements.append(Paragraph(summary_text, styles['Highlight']))
    elif success_rate >= 75:
        summary_text = f"Your retirement plan shows a <b>{format_percent(success_rate)}</b> success rate under moderate market conditions. This is a good result, though some adjustments could improve your chances further."
        elements.append(Paragraph(summary_text, styles['ReportBody']))
    else:
        summary_text = f"Your retirement plan shows a <b>{format_percent(success_rate)}</b> success rate under moderate market conditions. Consider adjusting your spending, savings, or retirement date to improve this outlook."
        elements.append(Paragraph(summary_text, styles['Warning']))

    elements.append(Spacer(1, 15))

    # Simulation Parameters
    elements.append(Paragraph("Simulation Parameters", styles['SectionTitle']))

    params_data = [
        ['Parameter', 'Value'],
        ['Number of Simulations', f"{analysis_results.get('simulations', 10000):,}"],
        ['Years Projected', str(analysis_results.get('years_projected', 30))],
        ['Total Assets', format_currency(analysis_results.get('total_assets', 0))],
    ]

    params_table = Table(params_data, colWidths=[3*inch, 3*inch])
    params_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ecf0f1')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(params_table)
    elements.append(Spacer(1, 20))

    # Scenario Results
    elements.append(Paragraph("Scenario Analysis", styles['SectionTitle']))
    elements.append(Paragraph(
        "Results across different asset allocation strategies:",
        styles['ReportBody']
    ))

    scenario_data = [
        ['Scenario', 'Success Rate', 'Median Balance', '5th Percentile', '95th Percentile']
    ]

    for key in ['conservative', 'moderate', 'aggressive']:
        scenario = scenarios.get(key, {})
        scenario_data.append([
            scenario.get('scenario_name', key.title()),
            format_percent(scenario.get('success_rate', 0)),
            format_currency(scenario.get('median_ending_wealth', 0)),
            format_currency(scenario.get('percentile_5', 0)),
            format_currency(scenario.get('percentile_95', 0)),
        ])

    scenario_table = Table(scenario_data, colWidths=[1.3*inch, 1.1*inch, 1.3*inch, 1.3*inch, 1.3*inch])
    scenario_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
    ]))
    elements.append(scenario_table)
    elements.append(Spacer(1, 20))

    # Interpretation
    elements.append(Paragraph("Understanding Your Results", styles['SectionTitle']))

    interpretations = [
        "<b>Success Rate:</b> The percentage of simulations where your portfolio lasted throughout retirement without depleting.",
        "<b>Median Balance:</b> The middle outcome - half of simulations end higher, half lower.",
        "<b>5th Percentile:</b> The worst-case scenario (only 5% of simulations were worse).",
        "<b>95th Percentile:</b> The best-case scenario (only 5% of simulations were better).",
    ]

    for text in interpretations:
        elements.append(Paragraph(text, styles['ReportBody']))

    elements.append(Spacer(1, 15))

    # Recommendations
    elements.append(Paragraph("Key Insights", styles['SectionTitle']))

    if success_rate >= 90:
        recommendations = [
            "Your plan is well-positioned for retirement success.",
            "Consider whether you might be able to increase spending or retire earlier.",
            "Review annually to ensure you stay on track.",
        ]
    elif success_rate >= 75:
        recommendations = [
            "Your plan has a reasonable chance of success.",
            "Consider increasing savings or delaying retirement slightly to improve odds.",
            "Review Social Security claiming strategy for optimization.",
        ]
    else:
        recommendations = [
            "Your plan may benefit from adjustments to improve success probability.",
            "Consider reducing planned spending in retirement.",
            "Explore delaying retirement or Social Security claiming.",
            "Review asset allocation for appropriate risk level.",
        ]

    for rec in recommendations:
        elements.append(Paragraph(f"• {rec}", styles['ReportBody']))

    # Disclaimer
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#bdc3c7')))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "<i>Disclaimer: This analysis is for informational purposes only and should not be considered financial advice. "
        "Past performance does not guarantee future results. Please consult with qualified financial professionals "
        "before making retirement decisions.</i>",
        styles['SmallText']
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_portfolio_report(profile_data):
    """Generate portfolio summary PDF report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    styles = create_styles()
    elements = []

    # Header
    profile_name = profile_data.get('name', 'Unnamed Profile')
    elements.extend(create_header(profile_name, "Portfolio Summary Report"))

    # Assets Overview
    elements.append(Paragraph("Assets Overview", styles['SectionTitle']))

    assets = profile_data.get('assets', {})
    retirement_accounts = assets.get('retirement_accounts', [])
    taxable_accounts = assets.get('taxable_accounts', [])

    total_retirement = sum(a.get('value', 0) for a in retirement_accounts)
    total_taxable = sum(a.get('value', 0) for a in taxable_accounts)
    total_assets = total_retirement + total_taxable

    overview_data = [
        ['Category', 'Value', 'Percentage'],
        ['Retirement Accounts', format_currency(total_retirement), format_percent(total_retirement / total_assets * 100 if total_assets > 0 else 0)],
        ['Taxable Accounts', format_currency(total_taxable), format_percent(total_taxable / total_assets * 100 if total_assets > 0 else 0)],
        ['Total Portfolio', format_currency(total_assets), '100%'],
    ]

    overview_table = Table(overview_data, colWidths=[2.5*inch, 2*inch, 1.5*inch])
    overview_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecf0f1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8f9fa')]),
    ]))
    elements.append(overview_table)
    elements.append(Spacer(1, 25))

    # Retirement Accounts Detail
    if retirement_accounts:
        elements.append(Paragraph("Retirement Accounts", styles['SectionTitle']))

        retirement_data = [['Account Name', 'Type', 'Value']]
        for account in retirement_accounts:
            retirement_data.append([
                account.get('name', 'Unnamed'),
                account.get('type', 'Unknown').replace('_', ' ').title(),
                format_currency(account.get('value', 0))
            ])

        retirement_table = Table(retirement_data, colWidths=[2.5*inch, 2*inch, 1.5*inch])
        retirement_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27ae60')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(retirement_table)
        elements.append(Spacer(1, 20))

    # Taxable Accounts Detail
    if taxable_accounts:
        elements.append(Paragraph("Taxable Accounts", styles['SectionTitle']))

        taxable_data = [['Account Name', 'Type', 'Value']]
        for account in taxable_accounts:
            taxable_data.append([
                account.get('name', 'Unnamed'),
                account.get('type', 'Unknown').replace('_', ' ').title(),
                format_currency(account.get('value', 0))
            ])

        taxable_table = Table(taxable_data, colWidths=[2.5*inch, 2*inch, 1.5*inch])
        taxable_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9b59b6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(taxable_table)
        elements.append(Spacer(1, 20))

    # Financial Information
    financial = profile_data.get('financial', {})
    if financial:
        elements.append(Paragraph("Financial Overview", styles['SectionTitle']))

        financial_data = [
            ['Item', 'Amount'],
            ['Annual Income', format_currency(financial.get('annual_income', 0))],
            ['Annual Expenses', format_currency(financial.get('annual_expenses', 0))],
            ['Social Security (Monthly)', format_currency(financial.get('social_security_benefit', 0))],
            ['Pension (Monthly)', format_currency(financial.get('pension_benefit', 0))],
        ]

        financial_table = Table(financial_data, colWidths=[3*inch, 2*inch])
        financial_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(financial_table)

    # Disclaimer
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#bdc3c7')))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "<i>This portfolio summary is for informational purposes only. Values shown may not reflect "
        "current market prices. Please verify all account balances with your financial institutions.</i>",
        styles['SmallText']
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_action_plan_report(profile_data, action_items):
    """Generate action plan PDF report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    styles = create_styles()
    elements = []

    # Header
    profile_name = profile_data.get('name', 'Unnamed Profile')
    elements.extend(create_header(profile_name, "Action Plan Report"))

    # Summary
    elements.append(Paragraph("Action Items Summary", styles['SectionTitle']))

    pending = [a for a in action_items if a.get('status') == 'pending']
    in_progress = [a for a in action_items if a.get('status') == 'in_progress']
    completed = [a for a in action_items if a.get('status') == 'completed']

    summary_text = f"You have <b>{len(action_items)}</b> total action items: "
    summary_text += f"<b>{len(pending)}</b> pending, "
    summary_text += f"<b>{len(in_progress)}</b> in progress, "
    summary_text += f"<b>{len(completed)}</b> completed."
    elements.append(Paragraph(summary_text, styles['ReportBody']))
    elements.append(Spacer(1, 15))

    # Priority items (Pending and In Progress)
    active_items = pending + in_progress
    if active_items:
        elements.append(Paragraph("Priority Items", styles['SectionTitle']))

        # Sort by priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        active_items.sort(key=lambda x: priority_order.get(x.get('priority', 'medium'), 1))

        priority_data = [['Priority', 'Status', 'Action Item', 'Due Date']]
        for item in active_items:
            # Use title if available, otherwise use description
            action_text = item.get('title') or item.get('description', 'Untitled Action')
            priority_data.append([
                item.get('priority', 'medium').title(),
                item.get('status', 'pending').replace('_', ' ').title(),
                action_text[:50] + ('...' if len(action_text) > 50 else ''),
                item.get('due_date', 'Not set') or 'Not set'
            ])

        priority_table = Table(priority_data, colWidths=[0.8*inch, 1*inch, 3.2*inch, 1*inch])
        priority_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e74c3c')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(priority_table)
        elements.append(Spacer(1, 20))

    # Detailed descriptions
    if active_items:
        elements.append(Paragraph("Detailed Action Items", styles['SectionTitle']))

        for i, item in enumerate(active_items, 1):
            # Use title for the heading
            title_text = item.get('title') or item.get('description', 'Untitled Action')
            elements.append(Paragraph(
                f"{i}. {title_text}",
                styles['SubSection']
            ))

            # Show description separately if it exists and is different from title
            description = item.get('description', '')
            if description and description != title_text:
                elements.append(Paragraph(description, styles['ReportBody']))

            elements.append(Paragraph(
                f"Priority: {item.get('priority', 'medium').title()} | "
                f"Status: {item.get('status', 'pending').replace('_', ' ').title()} | "
                f"Due: {item.get('due_date', 'Not set') or 'Not set'}",
                styles['SmallText']
            ))
            elements.append(Spacer(1, 10))

    # Completed items
    if completed:
        elements.append(Paragraph("Completed Items", styles['SectionTitle']))

        completed_data = [['Action Item', 'Completed']]
        for item in completed[-10:]:  # Show last 10 completed
            # Use title if available, otherwise use description
            action_text = item.get('title') or item.get('description', 'Untitled Action')
            completed_data.append([
                action_text[:60] + ('...' if len(action_text) > 60 else ''),
                item.get('updated_at', 'Unknown')[:10] if item.get('updated_at') else 'Unknown'
            ])

        completed_table = Table(completed_data, colWidths=[5*inch, 1*inch])
        completed_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27ae60')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(completed_table)

    # No items message
    if not action_items:
        elements.append(Paragraph(
            "No action items have been created yet. Use the AI Advisor feature to get "
            "personalized recommendations for your retirement plan.",
            styles['ReportBody']
        ))

    # Disclaimer
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#bdc3c7')))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "<i>This action plan is generated based on your profile data and should be reviewed "
        "with qualified financial professionals before implementation.</i>",
        styles['SmallText']
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
