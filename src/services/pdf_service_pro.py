"""Professional PDF generation service with charts and detailed analysis."""
import io
import os
import tempfile
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np


# Professional color palette
COLORS = {
    'primary': colors.HexColor('#1a237e'),      # Deep blue
    'secondary': colors.HexColor('#0277bd'),    # Light blue
    'accent': colors.HexColor('#00acc1'),       # Cyan
    'success': colors.HexColor('#2e7d32'),      # Green
    'warning': colors.HexColor('#f57c00'),      # Orange
    'danger': colors.HexColor('#c62828'),       # Red
    'text': colors.HexColor('#212121'),         # Dark gray
    'text_light': colors.HexColor('#757575'),   # Medium gray
    'bg_light': colors.HexColor('#f5f5f5'),     # Light gray
    'bg_white': colors.white,
    'border': colors.HexColor('#e0e0e0'),       # Border gray
}


def create_professional_styles():
    """Create professional paragraph styles."""
    styles = getSampleStyleSheet()

    def add_style(name, **kwargs):
        if name in styles:
            return
        styles.add(ParagraphStyle(name=name, **kwargs))

    # Cover page title
    add_style(
        'CoverTitle',
        parent=styles['Heading1'],
        fontSize=36,
        textColor=COLORS['primary'],
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    # Cover subtitle
    add_style(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontSize=18,
        textColor=COLORS['secondary'],
        spaceAfter=40,
        alignment=TA_CENTER,
        fontName='Helvetica'
    )

    # Report title
    add_style(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=10,
        textColor=COLORS['primary'],
        fontName='Helvetica-Bold'
    )

    # Section title with colored background
    add_style(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=COLORS['primary'],
        fontName='Helvetica-Bold'
    )

    # Subsection
    add_style(
        'SubSection',
        parent=styles['Heading3'],
        fontSize=13,
        spaceBefore=12,
        spaceAfter=8,
        textColor=COLORS['secondary'],
        fontName='Helvetica-Bold'
    )

    # Body text
    add_style(
        'ReportBody',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=8,
        leading=16,
        alignment=TA_JUSTIFY,
        textColor=COLORS['text']
    )

    # Highlight box
    add_style(
        'Highlight',
        parent=styles['Normal'],
        fontSize=12,
        textColor=COLORS['success'],
        spaceBefore=8,
        spaceAfter=8,
        leftIndent=20,
        rightIndent=20,
        fontName='Helvetica-Bold'
    )

    # Warning box
    add_style(
        'Warning',
        parent=styles['Normal'],
        fontSize=11,
        textColor=COLORS['warning'],
        spaceBefore=8,
        spaceAfter=8,
        leftIndent=20,
        rightIndent=20,
        fontName='Helvetica-Bold'
    )

    # Small text
    add_style(
        'SmallText',
        parent=styles['Normal'],
        fontSize=9,
        textColor=COLORS['text_light'],
        leading=12
    )

    # Footnote
    add_style(
        'Footnote',
        parent=styles['Normal'],
        fontSize=8,
        textColor=COLORS['text_light'],
        alignment=TA_CENTER,
        fontStyle='italic'
    )

    return styles


def format_currency(value):
    """Format a number as currency."""
    if value is None:
        return '$0'
    if abs(value) >= 1_000_000:
        return f"${value/1_000_000:.2f}M"
    elif abs(value) >= 1_000:
        return f"${value/1_000:.0f}K"
    return f"${value:,.0f}"


def format_percent(value):
    """Format a number as percentage."""
    if value is None:
        return '0%'
    return f"{value:.1f}%"


def create_chart_success_rates(scenarios, output_path):
    """Create bar chart of success rates."""
    fig, ax = plt.subplots(figsize=(8, 4), facecolor='white')

    scenario_names = []
    success_rates = []
    colors_list = []

    for key in ['conservative', 'moderate', 'aggressive']:
        scenario = scenarios.get(key, {})
        scenario_names.append(scenario.get('scenario_name', key.title()))
        rate = scenario.get('success_rate', 0)
        success_rates.append(rate)

        # Color based on success rate
        if rate >= 90:
            colors_list.append('#2e7d32')  # Green
        elif rate >= 75:
            colors_list.append('#f57c00')  # Orange
        else:
            colors_list.append('#c62828')  # Red

    bars = ax.bar(scenario_names, success_rates, color=colors_list, alpha=0.8, edgecolor='#1a237e', linewidth=2)

    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.1f}%',
                ha='center', va='bottom', fontsize=12, fontweight='bold')

    # Add target line at 90%
    ax.axhline(y=90, color='#2e7d32', linestyle='--', linewidth=2, alpha=0.5, label='Target: 90%')

    ax.set_ylabel('Success Rate (%)', fontsize=12, fontweight='bold')
    ax.set_title('Retirement Plan Success Rates by Scenario', fontsize=14, fontweight='bold', pad=20)
    ax.set_ylim(0, 110)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.legend(loc='upper right')

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()


def create_chart_portfolio_projection(scenarios, output_path):
    """Create line chart of portfolio projections."""
    fig, ax = plt.subplots(figsize=(8, 5), facecolor='white')

    # Plot each scenario
    for key, color, label in [
        ('conservative', '#1a237e', 'Conservative (30% stocks)'),
        ('moderate', '#0277bd', 'Moderate (60% stocks)'),
        ('aggressive', '#00acc1', 'Aggressive (80% stocks)')
    ]:
        scenario = scenarios.get(key, {})
        timeline = scenario.get('timeline', {})
        years = timeline.get('years', [])
        median = timeline.get('median', [])

        if years and median:
            ax.plot(years, [v/1000 for v in median], color=color, linewidth=2.5, label=label, alpha=0.8)

    ax.set_xlabel('Year', fontsize=12, fontweight='bold')
    ax.set_ylabel('Portfolio Value ($K)', fontsize=12, fontweight='bold')
    ax.set_title('Projected Portfolio Balance Over Time (Median Outcome)', fontsize=14, fontweight='bold', pad=20)
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.legend(loc='best', framealpha=0.9)

    # Format y-axis
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:.0f}K'))

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()


def create_chart_probability_distribution(scenario_data, output_path):
    """Create histogram of ending wealth distribution."""
    fig, ax = plt.subplots(figsize=(8, 4), facecolor='white')

    # Generate distribution data (simulated from percentiles)
    p5 = scenario_data.get('percentile_5', 0)
    median = scenario_data.get('median_ending_wealth', 0)
    p95 = scenario_data.get('percentile_95', 0)

    # Create simulated distribution
    # Approximate log-normal distribution from percentiles
    if p5 > 0 and median > 0 and p95 > 0:
        mu = np.log(median)
        sigma = (np.log(p95) - np.log(p5)) / 3.29  # 3.29 ≈ 2 * 1.645 (90% range)
        data = np.random.lognormal(mu, sigma, 1000)
        data = data[(data >= p5 * 0.5) & (data <= p95 * 1.5)]  # Trim outliers
    else:
        data = []

    if len(data) > 0:
        ax.hist(data/1000, bins=40, color='#0277bd', alpha=0.7, edgecolor='#1a237e')

        # Add percentile lines
        ax.axvline(p5/1000, color='#c62828', linestyle='--', linewidth=2, label=f'5th: {format_currency(p5)}')
        ax.axvline(median/1000, color='#2e7d32', linestyle='-', linewidth=2.5, label=f'Median: {format_currency(median)}')
        ax.axvline(p95/1000, color='#00acc1', linestyle='--', linewidth=2, label=f'95th: {format_currency(p95)}')

        ax.set_xlabel('Ending Portfolio Value ($K)', fontsize=12, fontweight='bold')
        ax.set_ylabel('Frequency', fontsize=12, fontweight='bold')
        ax.set_title('Distribution of Retirement Outcomes', fontsize=14, fontweight='bold', pad=20)
        ax.legend(loc='upper right', framealpha=0.9)
        ax.grid(axis='y', alpha=0.3, linestyle='--')

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()


def create_cover_page(profile_name, report_type, styles):
    """Create a professional cover page."""
    elements = []

    # Add vertical space
    elements.append(Spacer(1, 2*inch))

    # Title
    elements.append(Paragraph(report_type, styles['CoverTitle']))
    elements.append(Spacer(1, 0.3*inch))

    # Profile name
    elements.append(Paragraph(f"For: {profile_name}", styles['CoverSubtitle']))
    elements.append(Spacer(1, 0.5*inch))

    # Date with box
    date_str = datetime.now().strftime("%B %d, %Y")
    elements.append(Paragraph(
        f"<para align=center><b>Generated:</b> {date_str}</para>",
        styles['ReportBody']
    ))

    elements.append(Spacer(1, 3*inch))

    # Footer
    elements.append(Paragraph(
        "<para align=center><i>Comprehensive Retirement Planning Analysis</i></para>",
        styles['SmallText']
    ))
    elements.append(Paragraph(
        "<para align=center><i>RPS - Authored by pan</i></para>",
        styles['SmallText']
    ))

    elements.append(PageBreak())
    return elements


def create_executive_summary_box(title, content, color, styles):
    """Create a colored box for executive summary."""
    elements = []

    # Create table for colored box
    data = [[Paragraph(f"<b>{title}</b><br/>{content}", styles['ReportBody'])]]

    table = Table(data, colWidths=[6.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color.clone(alpha=0.1)),
        ('BOX', (0, 0), (-1, -1), 2, color),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 15))

    return elements


def generate_professional_analysis_report(profile_data, analysis_results):
    """Generate professional analysis report with charts."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch,
        title=f"Retirement Analysis Report - {profile_data.get('name', 'Profile')}"
    )

    styles = create_professional_styles()
    elements = []
    temp_files = []  # Track temp files to delete after PDF is built

    # Cover page
    profile_name = profile_data.get('name', 'Unnamed Profile')
    elements.extend(create_cover_page(profile_name, "Retirement Analysis Report", styles))

    # Table of Contents
    elements.append(Paragraph("Table of Contents", styles['SectionTitle']))
    toc_items = [
        "1. Executive Summary",
        "2. Simulation Overview",
        "3. Scenario Analysis",
        "4. Portfolio Projections",
        "5. Risk Assessment",
        "6. Key Insights & Recommendations",
        "7. Methodology & Assumptions"
    ]
    for item in toc_items:
        elements.append(Paragraph(f"<bullet>•</bullet> {item}", styles['ReportBody']))
    elements.append(Spacer(1, 10))
    elements.append(PageBreak())

    # === EXECUTIVE SUMMARY ===
    elements.append(Paragraph("1. Executive Summary", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    scenarios = analysis_results.get('scenarios', {})
    moderate = scenarios.get('moderate', {})
    conservative = scenarios.get('conservative', {})
    aggressive = scenarios.get('aggressive', {})

    success_rate = moderate.get('success_rate', 0)
    median_balance = moderate.get('median_ending_wealth', 0)
    total_assets = analysis_results.get('total_assets', 0)
    years = analysis_results.get('years_projected', 30)

    # Determine overall assessment
    if success_rate >= 90:
        assessment_color = COLORS['success']
        assessment = "Excellent"
        summary_text = f"""Your retirement plan demonstrates <b>strong financial security</b> with a {format_percent(success_rate)} success rate
        under moderate market conditions. Based on {analysis_results.get('simulations', 10000):,} Monte Carlo simulations projecting {years} years
        into retirement, your portfolio of {format_currency(total_assets)} is well-positioned to support your retirement lifestyle."""
    elif success_rate >= 75:
        assessment_color = COLORS['warning']
        assessment = "Good"
        summary_text = f"""Your retirement plan shows <b>reasonable prospects</b> with a {format_percent(success_rate)} success rate
        under moderate market conditions. Based on {analysis_results.get('simulations', 10000):,} Monte Carlo simulations projecting {years} years
        into retirement, your portfolio of {format_currency(total_assets)} provides a solid foundation, though some optimization opportunities exist."""
    else:
        assessment_color = COLORS['danger']
        assessment = "Needs Attention"
        summary_text = f"""Your retirement plan indicates <b>areas for improvement</b> with a {format_percent(success_rate)} success rate
        under moderate market conditions. Based on {analysis_results.get('simulations', 10000):,} Monte Carlo simulations projecting {years} years
        into retirement, adjustments to your strategy could significantly enhance your financial security."""

    elements.extend(create_executive_summary_box(
        f"Overall Assessment: {assessment}",
        summary_text,
        assessment_color,
        styles
    ))

    # Key metrics table
    elements.append(Paragraph("Key Performance Indicators", styles['SubSection']))
    elements.append(Spacer(1, 5))

    kpi_data = [
        ['Metric', 'Conservative', 'Moderate', 'Aggressive'],
        ['Success Rate',
         format_percent(conservative.get('success_rate', 0)),
         format_percent(moderate.get('success_rate', 0)),
         format_percent(aggressive.get('success_rate', 0))],
        ['Median Final Balance',
         format_currency(conservative.get('median_ending_wealth', 0)),
         format_currency(moderate.get('median_ending_wealth', 0)),
         format_currency(aggressive.get('median_ending_wealth', 0))],
        ['Worst Case (5th %ile)',
         format_currency(conservative.get('percentile_5', 0)),
         format_currency(moderate.get('percentile_5', 0)),
         format_currency(aggressive.get('percentile_5', 0))],
        ['Best Case (95th %ile)',
         format_currency(conservative.get('percentile_95', 0)),
         format_currency(moderate.get('percentile_95', 0)),
         format_currency(aggressive.get('percentile_95', 0))]
    ]

    kpi_table = Table(kpi_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COLORS['primary']),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, COLORS['border']),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [COLORS['bg_white'], COLORS['bg_light']]),
    ]))
    elements.append(kpi_table)
    elements.append(PageBreak())

    # === SIMULATION OVERVIEW ===
    elements.append(Paragraph("2. Simulation Overview", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    overview_text = f"""Monte Carlo simulation is a sophisticated statistical technique that models thousands of possible retirement scenarios
    by randomly varying market returns, inflation rates, and other financial factors. This analysis ran <b>{analysis_results.get('simulations', 10000):,}
    independent simulations</b>, each representing a unique potential future spanning <b>{years} years</b> of retirement."""
    elements.append(Paragraph(overview_text, styles['ReportBody']))
    elements.append(Spacer(1, 10))

    methodology_text = """<b>How It Works:</b> Each simulation starts with your current portfolio and applies randomized (but realistic)
    annual returns based on historical market data. The simulation withdraws your planned annual expenses, adjusts for inflation,
    and tracks whether your portfolio sustains throughout retirement. The "success rate" represents the percentage of simulations
    where you didn't run out of money."""
    elements.append(Paragraph(methodology_text, styles['ReportBody']))
    elements.append(Spacer(1, 15))

    # Create and embed success rate chart
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        chart_path = tmp.name
        temp_files.append(chart_path)  # Track for later cleanup
        create_chart_success_rates(scenarios, chart_path)

        img = Image(chart_path, width=6*inch, height=3*inch)
        elements.append(img)

    elements.append(Spacer(1, 10))

    # Chart explanation
    chart_explanation = """<b>Interpreting the Chart:</b> Success rates above 90% (green) indicate excellent retirement security.
    Rates between 75-90% (orange) suggest good prospects with room for improvement. Rates below 75% (red) indicate significant
    risk that warrants strategic adjustments to your plan."""
    elements.append(Paragraph(chart_explanation, styles['ReportBody']))
    elements.append(PageBreak())

    # === SCENARIO ANALYSIS ===
    elements.append(Paragraph("3. Scenario Analysis", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    scenario_intro = """Different asset allocations produce varying levels of growth potential and risk. This analysis
    examines three standard investment strategies to help you understand the trade-offs between risk and return."""
    elements.append(Paragraph(scenario_intro, styles['ReportBody']))
    elements.append(Spacer(1, 15))

    # Conservative scenario
    elements.append(Paragraph("Conservative Strategy (30% Stocks / 70% Bonds)", styles['SubSection']))
    con_rate = conservative.get('success_rate', 0)
    con_text = f"""<b>Success Rate:</b> {format_percent(con_rate)}<br/>
    <b>Median Outcome:</b> {format_currency(conservative.get('median_ending_wealth', 0))}<br/><br/>
    This lower-risk approach prioritizes capital preservation over growth. While it reduces exposure to market volatility,
    it may also limit portfolio growth. {'This strategy shows strong stability for your retirement goals.' if con_rate >= 85
    else 'This conservative approach may benefit from slightly higher equity exposure to combat inflation.'}"""
    elements.append(Paragraph(con_text, styles['ReportBody']))
    elements.append(Spacer(1, 10))

    # Moderate scenario
    elements.append(Paragraph("Moderate Strategy (60% Stocks / 40% Bonds)", styles['SubSection']))
    mod_rate = moderate.get('success_rate', 0)
    mod_text = f"""<b>Success Rate:</b> {format_percent(mod_rate)}<br/>
    <b>Median Outcome:</b> {format_currency(moderate.get('median_ending_wealth', 0))}<br/><br/>
    This balanced approach combines growth potential with downside protection. It's often recommended for retirees seeking
    moderate growth while managing volatility. {'This allocation aligns well with your retirement timeline and risk tolerance.'
    if mod_rate >= 80 else 'Consider adjusting your asset allocation or spending to improve outcomes with this strategy.'}"""
    elements.append(Paragraph(mod_text, styles['ReportBody']))
    elements.append(Spacer(1, 10))

    # Aggressive scenario
    elements.append(Paragraph("Aggressive Strategy (80% Stocks / 20% Bonds)", styles['SubSection']))
    agg_rate = aggressive.get('success_rate', 0)
    agg_text = f"""<b>Success Rate:</b> {format_percent(agg_rate)}<br/>
    <b>Median Outcome:</b> {format_currency(aggressive.get('median_ending_wealth', 0))}<br/><br/>
    This growth-oriented approach maximizes equity exposure for long-term appreciation. While it offers higher potential returns,
    it comes with increased short-term volatility. {'This aggressive stance may be appropriate for early retirees with long time horizons.'
    if agg_rate >= 75 else 'The higher volatility of this approach introduces significant risk to your retirement security.'}"""
    elements.append(Paragraph(agg_text, styles['ReportBody']))
    elements.append(PageBreak())

    # === PORTFOLIO PROJECTIONS ===
    elements.append(Paragraph("4. Portfolio Projections", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    projection_intro = """The following chart illustrates the median (50th percentile) projected portfolio balance over your
    retirement timeline under each asset allocation strategy. The median represents the "middle" outcome—half of simulations
    ended with more money, half with less."""
    elements.append(Paragraph(projection_intro, styles['ReportBody']))
    elements.append(Spacer(1, 15))

    # Create and embed portfolio projection chart
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        chart_path = tmp.name
        temp_files.append(chart_path)  # Track for later cleanup
        create_chart_portfolio_projection(scenarios, chart_path)

        img = Image(chart_path, width=6.5*inch, height=4*inch)
        elements.append(img)

    elements.append(Spacer(1, 10))

    projection_analysis = """<b>Key Observations:</b> The trajectory of your portfolio over time reveals important patterns.
    A steadily declining balance is typical as you withdraw funds for living expenses. The rate of decline depends on your
    withdrawal rate relative to portfolio growth. An increasing or stable balance suggests you may be able to spend more or
    leave a larger legacy. A rapidly declining balance that approaches zero indicates potential longevity risk."""
    elements.append(Paragraph(projection_analysis, styles['ReportBody']))
    elements.append(PageBreak())

    # === RISK ASSESSMENT ===
    elements.append(Paragraph("5. Risk Assessment", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    # Create probability distribution chart
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        chart_path = tmp.name
        temp_files.append(chart_path)  # Track for later cleanup
        create_chart_probability_distribution(moderate, chart_path)

        img = Image(chart_path, width=6.5*inch, height=3.5*inch)
        elements.append(img)

    elements.append(Spacer(1, 10))

    risk_text = f"""This distribution shows the range of possible outcomes under moderate asset allocation. The chart reveals:

    <b>• Worst-Case Scenario (5th Percentile):</b> Only 5% of simulations ended below {format_currency(moderate.get('percentile_5', 0))}.
    {'This provides a reasonable safety margin.' if moderate.get('percentile_5', 0) > total_assets * 0.3
    else 'This suggests significant downside risk in adverse markets.'}

    <b>• Most Likely Outcome (Median):</b> {format_currency(moderate.get('median_ending_wealth', 0))} represents the middle result,
    with equal probability of higher or lower outcomes.

    <b>• Best-Case Scenario (95th Percentile):</b> Only 5% of simulations exceeded {format_currency(moderate.get('percentile_95', 0))}.
    This upside potential could support increased spending or legacy planning.

    The width of this distribution reflects the uncertainty inherent in retirement planning over {years} years."""
    elements.append(Paragraph(risk_text, styles['ReportBody']))
    elements.append(PageBreak())

    # === KEY INSIGHTS ===
    elements.append(Paragraph("6. Key Insights & Recommendations", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    # Generate personalized recommendations
    recommendations = []

    if success_rate >= 90:
        recommendations.extend([
            ("Excellent Position", "Your retirement plan demonstrates strong financial security. You're well-positioned to meet your goals."),
            ("Opportunity for Optimization", "Consider whether you could safely increase retirement spending, retire earlier, or plan for legacy goals."),
            ("Maintain Discipline", "Continue your current savings and investment strategy. Review annually to ensure you stay on track."),
        ])
    elif success_rate >= 75:
        recommendations.extend([
            ("Solid Foundation", "Your plan has good prospects, though there's room to strengthen your retirement security."),
            ("Consider Adjustments", "Small modifications to savings rate, spending, or retirement timing could significantly improve outcomes."),
            ("Social Security Strategy", "Optimize your claiming age strategy—delaying can increase lifetime benefits substantially."),
            ("Annual Reviews", "Monitor progress yearly and make course corrections as needed."),
        ])
    else:
        recommendations.extend([
            ("Action Required", "Your current plan faces challenges that warrant strategic adjustments."),
            ("Increase Savings", "Boosting retirement contributions now can significantly improve long-term outcomes."),
            ("Reduce Planned Spending", "Consider moderating your expected retirement expenses by 10-15%."),
            ("Delay Retirement", "Working 2-3 additional years would both increase savings and reduce years of withdrawals."),
            ("Professional Guidance", "Consult with a fiduciary financial advisor to develop a comprehensive improvement strategy."),
        ])

    # Asset allocation recommendation
    best_scenario = max([('conservative', con_rate), ('moderate', mod_rate), ('aggressive', agg_rate)], key=lambda x: x[1])
    recommendations.append((
        "Optimal Asset Allocation",
        f"Based on your analysis, the {best_scenario[0]} strategy with {format_percent(best_scenario[1])} success rate appears most suitable for your situation."
    ))

    for title, desc in recommendations:
        elements.append(Paragraph(f"<b>{title}:</b>", styles['SubSection']))
        elements.append(Paragraph(desc, styles['ReportBody']))
        elements.append(Spacer(1, 10))

    elements.append(PageBreak())

    # === METHODOLOGY ===
    elements.append(Paragraph("7. Methodology & Assumptions", styles['SectionTitle']))
    elements.append(Spacer(1, 10))

    methodology_text = f"""<b>Monte Carlo Simulation:</b> This analysis employs Monte Carlo simulation, a statistical technique
    widely used in financial planning. By running {analysis_results.get('simulations', 10000):,} independent scenarios with randomized
    returns based on historical data, we can quantify the probability of various retirement outcomes.

    <b>Market Assumptions:</b> Returns are modeled using historically-informed probability distributions. Stock returns assume
    a mean annual return of 8-10% with 15-18% volatility. Bond returns assume 3-5% with 5-7% volatility. Actual returns will vary.

    <b>Inflation:</b> The model adjusts for inflation at approximately 2-3% annually to maintain purchasing power throughout retirement.

    <b>Withdrawal Strategy:</b> The analysis models systematic withdrawals adjusted for inflation, similar to the 4% rule but
    customized to your specific situation.

    <b>Important Limitations:</b> This analysis makes numerous simplifying assumptions. It cannot predict actual market performance,
    which may differ materially from historical patterns. Results should be viewed as directional guidance rather than precise predictions.

    <b>Not Financial Advice:</b> This report provides educational analysis only. It does not constitute financial, tax, or legal advice.
    Consult qualified professionals before making retirement decisions."""
    elements.append(Paragraph(methodology_text, styles['ReportBody']))

    # Disclaimer footer
    elements.append(Spacer(1, 40))
    elements.append(HRFlowable(width="100%", thickness=1, color=COLORS['border']))
    elements.append(Spacer(1, 15))
    elements.append(Paragraph(
        """<i>IMPORTANT DISCLAIMER: This analysis is provided for informational and educational purposes only. It is not intended
        as financial, investment, tax, or legal advice. Past performance does not guarantee future results. All investments carry risk,
        including potential loss of principal. Market conditions, tax laws, and personal circumstances change over time. Please consult
        with qualified financial professionals, tax advisors, and attorneys before making any financial decisions. The assumptions and
        projections in this report may not reflect your actual retirement experience.</i>""",
        styles['Footnote']
    ))

    # Build PDF
    doc.build(elements)

    # Clean up temporary chart files
    for temp_file in temp_files:
        try:
            if os.path.exists(temp_file):
                os.unlink(temp_file)
        except Exception as e:
            print(f"Warning: Could not delete temp file {temp_file}: {e}")

    buffer.seek(0)
    return buffer
