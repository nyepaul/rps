"""Report generation functions for PDF reports."""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
    Image,
)

from .base import (
    ColorPalette,
    NumberedCanvas,
    format_currency,
    format_percent,
    create_document,
)
from .styles import create_basic_styles, create_elite_styles, get_styles
from .charts import (
    create_success_rates_chart,
    create_portfolio_projection_chart,
    create_probability_distribution_chart,
    cleanup_chart_files,
)
from .components import (
    create_header,
    create_elite_cover_page,
    create_data_table,
    create_key_metrics_box,
    create_executive_summary_box,
    create_disclaimer,
)


def generate_analysis_report(profile_data, analysis_results):
    """Generate Monte Carlo analysis PDF report (basic style).

    Args:
        profile_data: Dict with profile information
        analysis_results: Dict with analysis results including scenarios

    Returns:
        BytesIO buffer containing PDF
    """
    buffer, doc = create_document(
        title=f"Analysis Report - {profile_data.get('name', 'Profile')}"
    )

    styles = create_basic_styles()
    colors_dict = ColorPalette.BASIC
    elements = []

    # Header
    profile_name = profile_data.get("name", "Unnamed Profile")
    elements.extend(
        create_header(profile_name, "Retirement Analysis Report", styles, colors_dict)
    )

    # Executive Summary
    elements.append(Paragraph("Executive Summary", styles["SectionTitle"]))

    scenarios = analysis_results.get("scenarios", {})
    moderate = scenarios.get("moderate", {})
    success_rate = moderate.get("success_rate", 0)

    if success_rate >= 90:
        summary_text = f"Your retirement plan shows a <b>{format_percent(success_rate)}</b> success rate under moderate market conditions. This is an excellent result indicating a high probability of meeting your retirement goals."
        elements.append(Paragraph(summary_text, styles["Highlight"]))
    elif success_rate >= 75:
        summary_text = f"Your retirement plan shows a <b>{format_percent(success_rate)}</b> success rate under moderate market conditions. This is a good result, though some adjustments could improve your chances further."
        elements.append(Paragraph(summary_text, styles["ReportBody"]))
    else:
        summary_text = f"Your retirement plan shows a <b>{format_percent(success_rate)}</b> success rate under moderate market conditions. Consider adjusting your spending, savings, or retirement date to improve this outlook."
        elements.append(Paragraph(summary_text, styles["Warning"]))

    elements.append(Spacer(1, 15))

    # Simulation Parameters
    elements.append(Paragraph("Simulation Parameters", styles["SectionTitle"]))

    params_data = [
        ["Parameter", "Value"],
        ["Number of Simulations", f"{analysis_results.get('simulations', 10000):,}"],
        ["Years Projected", str(analysis_results.get("years_projected", 30))],
        ["Total Assets", format_currency(analysis_results.get("total_assets", 0))],
    ]

    params_table = Table(params_data, colWidths=[3 * inch, 3 * inch])
    params_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors_dict["secondary"]),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BACKGROUND", (0, 1), (-1, -1), colors_dict["bg_light"]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors_dict["bg_alt"]],
                ),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
                ("TOPPADDING", (0, 1), (-1, -1), 8),
            ]
        )
    )
    elements.append(params_table)
    elements.append(Spacer(1, 20))

    # Scenario Results
    elements.append(Paragraph("Scenario Analysis", styles["SectionTitle"]))
    elements.append(
        Paragraph(
            "Results across different asset allocation strategies:",
            styles["ReportBody"],
        )
    )

    scenario_data = [
        [
            "Scenario",
            "Success Rate",
            "Median Balance",
            "5th Percentile",
            "95th Percentile",
        ]
    ]

    for key in ["conservative", "moderate", "aggressive"]:
        scenario = scenarios.get(key, {})
        scenario_data.append(
            [
                scenario.get("scenario_name", key.title()),
                format_percent(scenario.get("success_rate", 0)),
                format_currency(scenario.get("median_ending_wealth", 0)),
                format_currency(scenario.get("percentile_5", 0)),
                format_currency(scenario.get("percentile_95", 0)),
            ]
        )

    scenario_table = Table(
        scenario_data,
        colWidths=[1.3 * inch, 1.1 * inch, 1.3 * inch, 1.3 * inch, 1.3 * inch],
    )
    scenario_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors_dict["secondary"]),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors_dict["bg_alt"]],
                ),
            ]
        )
    )
    elements.append(scenario_table)
    elements.append(Spacer(1, 20))

    # Understanding Results
    elements.append(Paragraph("Understanding Your Results", styles["SectionTitle"]))

    interpretations = [
        "<b>Success Rate:</b> The percentage of simulations where your portfolio lasted throughout retirement without depleting.",
        "<b>Median Balance:</b> The middle outcome - half of simulations end higher, half lower.",
        "<b>5th Percentile:</b> The worst-case scenario (only 5% of simulations were worse).",
        "<b>95th Percentile:</b> The best-case scenario (only 5% of simulations were better).",
    ]

    for text in interpretations:
        elements.append(Paragraph(text, styles["ReportBody"]))

    elements.append(Spacer(1, 15))

    # Recommendations
    elements.append(Paragraph("Key Insights", styles["SectionTitle"]))

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
        elements.append(Paragraph(f"• {rec}", styles["ReportBody"]))

    # Disclaimer
    elements.extend(create_disclaimer(styles))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_elite_analysis_report(profile_data, analysis_results):
    """Generate elite professional analysis report with charts.

    Args:
        profile_data: Dict with profile information
        analysis_results: Dict with analysis results including scenarios

    Returns:
        BytesIO buffer containing PDF
    """
    buffer = io.BytesIO()

    profile_name = profile_data.get("name", "Client")
    report_type = "Comprehensive Retirement Analysis"

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=1.0 * inch,
        leftMargin=1.0 * inch,
        topMargin=1.1 * inch,
        bottomMargin=0.95 * inch,
        title=f"{report_type} - {profile_name}",
    )

    styles = create_elite_styles()
    colors_dict = ColorPalette.ELITE
    elements = []
    temp_files = []

    # Cover page
    elements.extend(
        create_elite_cover_page(profile_name, report_type, styles, colors_dict)
    )

    # Executive Summary
    elements.append(Paragraph("Executive Summary", styles["SectionHeader"]))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=colors_dict["navy"],
            spaceBefore=8,
            spaceAfter=18,
        )
    )

    total_assets = analysis_results.get("total_assets", 0)
    scenarios = analysis_results.get("scenarios", {})
    years = analysis_results.get("years_projected", 30)

    summary_text = (
        f"This comprehensive retirement analysis presents Monte Carlo simulations across multiple "
        f"asset allocation scenarios. Based on current assets of <b>${total_assets:,.0f}</b>, "
        f"we have modeled {analysis_results.get('simulations', 1000):,} simulations over "
        f"{years} years to project potential outcomes."
    )
    elements.append(Paragraph(summary_text, styles["BodyText"]))
    elements.append(Spacer(1, 20))

    # Key Metrics
    if scenarios:
        moderate_scenario = scenarios.get("moderate", {})
        financial = profile_data.get("financial", {})
        spouse = profile_data.get("spouse", {})

        metrics = {
            "Total Assets": total_assets,
            "Success Rate": f"{moderate_scenario.get('success_rate', 0):.1f}%",
            "Median Outcome": moderate_scenario.get(
                "median_ending_wealth", moderate_scenario.get("median_final_value", 0)
            ),
            "Years Projected": years,
            "Social Security": financial.get("social_security_benefit", 0),
            "Claiming Age": financial.get("ss_claiming_age", 67),
        }

        if spouse and spouse.get("name"):
            metrics["Spouse SS"] = spouse.get("social_security_benefit", 0)
            metrics["Spouse Age"] = spouse.get("ss_claiming_age", 67)

        elements.extend(
            create_key_metrics_box("Key Metrics", metrics, styles, colors_dict)
        )

    # Scenario Analysis
    elements.append(PageBreak())
    elements.append(Paragraph("Scenario Analysis", styles["SectionHeader"]))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=colors_dict["navy"],
            spaceBefore=8,
            spaceAfter=18,
        )
    )

    # Try to create success rates chart
    try:
        chart_path = create_success_rates_chart(scenarios)
        temp_files.append(chart_path)
        img = Image(chart_path, width=6 * inch, height=3 * inch)
        elements.append(img)
        elements.append(Spacer(1, 15))
    except Exception:
        pass  # Skip chart if generation fails

    # Scenario table
    scenario_data = []
    for scenario_key in ["conservative", "moderate", "aggressive"]:
        scenario_result = scenarios.get(scenario_key, {})
        scenario_name = scenario_result.get("scenario_name", scenario_key.title())
        success_rate = scenario_result.get("success_rate", 0)
        median_value = scenario_result.get(
            "median_ending_wealth", scenario_result.get("median_final_value", 0)
        )
        percentile_5 = scenario_result.get(
            "percentile_5", scenario_result.get("percentile_10", 0)
        )
        percentile_95 = scenario_result.get(
            "percentile_95", scenario_result.get("percentile_90", 0)
        )

        scenario_data.append(
            [
                scenario_name,
                f"{success_rate:.1f}%",
                format_currency(median_value),
                format_currency(percentile_5),
                format_currency(percentile_95),
            ]
        )

    if scenario_data:
        headers = [
            "Scenario",
            "Success Rate",
            "Median Final",
            "5th Percentile",
            "95th Percentile",
        ]
        scenario_table = create_data_table(
            headers,
            scenario_data,
            styles,
            colors_dict,
            col_widths=[1.5, 1.2, 1.3, 1.25, 1.25],
        )
        elements.append(scenario_table)

    # Portfolio projections
    elements.append(PageBreak())
    elements.append(Paragraph("Portfolio Projections", styles["SectionHeader"]))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=colors_dict["navy"],
            spaceBefore=8,
            spaceAfter=18,
        )
    )

    projection_text = """The following analysis illustrates the projected portfolio balance over your
    retirement timeline under each asset allocation strategy. Results show median (50th percentile) outcomes."""
    elements.append(Paragraph(projection_text, styles["BodyText"]))
    elements.append(Spacer(1, 15))

    # Try to create portfolio projection chart
    try:
        chart_path = create_portfolio_projection_chart(scenarios)
        temp_files.append(chart_path)
        img = Image(chart_path, width=6.5 * inch, height=4 * inch)
        elements.append(img)
    except Exception:
        pass  # Skip chart if generation fails

    # Risk Assessment
    elements.append(PageBreak())
    elements.append(Paragraph("Risk Assessment", styles["SectionHeader"]))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=colors_dict["navy"],
            spaceBefore=8,
            spaceAfter=18,
        )
    )

    moderate = scenarios.get("moderate", {})
    try:
        chart_path = create_probability_distribution_chart(moderate)
        temp_files.append(chart_path)
        img = Image(chart_path, width=6.5 * inch, height=3.5 * inch)
        elements.append(img)
        elements.append(Spacer(1, 10))
    except Exception:
        pass

    p5 = moderate.get("percentile_5", 0)
    p95 = moderate.get("percentile_95", 0)
    median_val = moderate.get("median_ending_wealth", 0)

    risk_text = f"""This distribution shows the range of possible outcomes under moderate asset allocation:

    <b>• Worst-Case Scenario (5th Percentile):</b> Only 5% of simulations ended below {format_currency(p5)}.

    <b>• Most Likely Outcome (Median):</b> {format_currency(median_val)} represents the middle result.

    <b>• Best-Case Scenario (95th Percentile):</b> Only 5% of simulations exceeded {format_currency(p95)}."""
    elements.append(Paragraph(risk_text, styles["BodyText"]))

    # Methodology
    elements.append(PageBreak())
    elements.append(Paragraph("Methodology & Assumptions", styles["SectionHeader"]))
    elements.append(
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=colors_dict["navy"],
            spaceBefore=8,
            spaceAfter=18,
        )
    )

    methodology_text = f"""<b>Monte Carlo Simulation:</b> This analysis employs Monte Carlo simulation, running
    {analysis_results.get('simulations', 10000):,} independent scenarios with randomized returns based on historical data.

    <b>Market Assumptions:</b> Returns are modeled using historically-informed probability distributions.
    Stock returns assume a mean annual return of 8-10% with 15-18% volatility. Bond returns assume 3-5% with 5-7% volatility.

    <b>Inflation:</b> The model adjusts for inflation at approximately 2-3% annually.

    <b>Important Limitations:</b> This analysis makes simplifying assumptions and cannot predict actual market performance.
    Results should be viewed as directional guidance rather than precise predictions.

    <b>Not Financial Advice:</b> This report provides educational analysis only. Consult qualified professionals."""
    elements.append(Paragraph(methodology_text, styles["BodyText"]))

    # Final disclaimer
    elements.append(Spacer(1, 40))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors_dict["border"]))
    elements.append(Spacer(1, 15))
    elements.append(
        Paragraph(
            """<i>IMPORTANT DISCLAIMER: This analysis is for informational and educational purposes only. It is not intended
        as financial, investment, tax, or legal advice. Past performance does not guarantee future results. Please consult
        with qualified financial professionals before making any financial decisions.</i>""",
            styles["SmallText"],
        )
    )

    # Build PDF with custom canvas
    doc.build(
        elements,
        canvasmaker=lambda *args, **kwargs: NumberedCanvas(
            *args,
            **kwargs,
            profile_name=profile_name,
            report_type=report_type,
            colors=colors_dict,
        ),
    )

    # Cleanup temporary chart files
    cleanup_chart_files(temp_files)

    buffer.seek(0)
    return buffer


def generate_portfolio_report(profile_data):
    """Generate portfolio summary PDF report.

    Args:
        profile_data: Dict with profile information including assets

    Returns:
        BytesIO buffer containing PDF
    """
    buffer, doc = create_document(
        title=f"Portfolio Summary - {profile_data.get('name', 'Profile')}"
    )

    styles = create_basic_styles()
    colors_dict = ColorPalette.BASIC
    elements = []

    # Header
    profile_name = profile_data.get("name", "Unnamed Profile")
    elements.extend(
        create_header(profile_name, "Portfolio Summary Report", styles, colors_dict)
    )

    # Assets Overview
    elements.append(Paragraph("Assets Overview", styles["SectionTitle"]))

    assets = profile_data.get("assets", {})
    retirement_accounts = assets.get("retirement_accounts", [])
    taxable_accounts = assets.get("taxable_accounts", [])

    total_retirement = sum(a.get("value", 0) for a in retirement_accounts)
    total_taxable = sum(a.get("value", 0) for a in taxable_accounts)
    total_assets = total_retirement + total_taxable

    overview_data = [
        ["Category", "Value", "Percentage"],
        [
            "Retirement Accounts",
            format_currency(total_retirement),
            format_percent(
                total_retirement / total_assets * 100 if total_assets > 0 else 0
            ),
        ],
        [
            "Taxable Accounts",
            format_currency(total_taxable),
            format_percent(
                total_taxable / total_assets * 100 if total_assets > 0 else 0
            ),
        ],
        ["Total Portfolio", format_currency(total_assets), "100%"],
    ]

    overview_table = Table(overview_data, colWidths=[2.5 * inch, 2 * inch, 1.5 * inch])
    overview_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors_dict["secondary"]),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                ("BACKGROUND", (0, -1), (-1, -1), colors_dict["bg_light"]),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -2),
                    [colors.white, colors_dict["bg_alt"]],
                ),
            ]
        )
    )
    elements.append(overview_table)
    elements.append(Spacer(1, 25))

    # Retirement Accounts Detail
    if retirement_accounts:
        elements.append(Paragraph("Retirement Accounts", styles["SectionTitle"]))

        retirement_data = [["Account Name", "Type", "Value"]]
        for account in retirement_accounts:
            retirement_data.append(
                [
                    account.get("name", "Unnamed"),
                    account.get("type", "Unknown").replace("_", " ").title(),
                    format_currency(account.get("value", 0)),
                ]
            )

        retirement_table = Table(
            retirement_data, colWidths=[2.5 * inch, 2 * inch, 1.5 * inch]
        )
        retirement_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors_dict["success"]),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (2, 0), (2, -1), "RIGHT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors_dict["bg_alt"]],
                    ),
                ]
            )
        )
        elements.append(retirement_table)
        elements.append(Spacer(1, 20))

    # Taxable Accounts Detail
    if taxable_accounts:
        elements.append(Paragraph("Taxable Accounts", styles["SectionTitle"]))

        taxable_data = [["Account Name", "Type", "Value"]]
        for account in taxable_accounts:
            taxable_data.append(
                [
                    account.get("name", "Unnamed"),
                    account.get("type", "Unknown").replace("_", " ").title(),
                    format_currency(account.get("value", 0)),
                ]
            )

        taxable_table = Table(
            taxable_data, colWidths=[2.5 * inch, 2 * inch, 1.5 * inch]
        )
        taxable_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#9b59b6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (2, 0), (2, -1), "RIGHT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors_dict["bg_alt"]],
                    ),
                ]
            )
        )
        elements.append(taxable_table)
        elements.append(Spacer(1, 20))

    # Financial Information
    financial = profile_data.get("financial", {})
    if financial:
        elements.append(Paragraph("Financial Overview", styles["SectionTitle"]))

        financial_data = [
            ["Item", "Amount"],
            ["Annual Income", format_currency(financial.get("annual_income", 0))],
            ["Annual Expenses", format_currency(financial.get("annual_expenses", 0))],
            [
                "Social Security (Monthly)",
                format_currency(financial.get("social_security_benefit", 0)),
            ],
            ["SS Claiming Age", str(financial.get("ss_claiming_age", 67))],
        ]

        # Add spouse info if exists
        spouse = profile_data.get("spouse", {})
        if spouse and spouse.get("name"):
            financial_data.append(
                [
                    "Spouse SS (Monthly)",
                    format_currency(spouse.get("social_security_benefit", 0)),
                ]
            )
            financial_data.append(
                ["Spouse SS Claiming Age", str(spouse.get("ss_claiming_age", 67))]
            )

        financial_data.append(
            ["Pension (Monthly)", format_currency(financial.get("pension_benefit", 0))]
        )

        financial_table = Table(financial_data, colWidths=[3 * inch, 2 * inch])
        financial_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors_dict["secondary"]),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors_dict["bg_alt"]],
                    ),
                ]
            )
        )
        elements.append(financial_table)

    # Disclaimer
    elements.append(Spacer(1, 30))
    elements.append(
        HRFlowable(width="100%", thickness=0.5, color=colors_dict["border"])
    )
    elements.append(Spacer(1, 10))
    elements.append(
        Paragraph(
            "<i>This portfolio summary is for informational purposes only. Values shown may not reflect "
            "current market prices. Please verify all account balances with your financial institutions.</i>",
            styles["SmallText"],
        )
    )

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_action_plan_report(profile_data, action_items):
    """Generate action plan PDF report.

    Args:
        profile_data: Dict with profile information
        action_items: List of action item dicts

    Returns:
        BytesIO buffer containing PDF
    """
    buffer, doc = create_document(
        title=f"Action Plan - {profile_data.get('name', 'Profile')}"
    )

    styles = create_basic_styles()
    colors_dict = ColorPalette.BASIC
    elements = []

    # Header
    profile_name = profile_data.get("name", "Unnamed Profile")
    elements.extend(
        create_header(profile_name, "Action Plan Report", styles, colors_dict)
    )

    # Summary
    elements.append(Paragraph("Action Items Summary", styles["SectionTitle"]))

    # Convert objects to dicts if necessary
    processed_items = []
    for item in action_items:
        if hasattr(item, "to_dict"):
            processed_items.append(item.to_dict())
        else:
            processed_items.append(item)

    action_items = processed_items

    pending = [a for a in action_items if a.get("status") == "pending"]
    in_progress = [a for a in action_items if a.get("status") == "in_progress"]
    completed = [a for a in action_items if a.get("status") == "completed"]

    summary_text = f"You have <b>{len(action_items)}</b> total action items: "
    summary_text += f"<b>{len(pending)}</b> pending, "
    summary_text += f"<b>{len(in_progress)}</b> in progress, "
    summary_text += f"<b>{len(completed)}</b> completed."
    elements.append(Paragraph(summary_text, styles["ReportBody"]))
    elements.append(Spacer(1, 15))

    # Priority items
    active_items = pending + in_progress
    if active_items:
        elements.append(Paragraph("Priority Items", styles["SectionTitle"]))

        priority_order = {"high": 0, "medium": 1, "low": 2}
        active_items.sort(
            key=lambda x: priority_order.get(x.get("priority", "medium"), 1)
        )

        priority_data = [["Priority", "Status", "Action Item", "Due Date"]]
        for item in active_items:
            action_text = item.get("title") or item.get(
                "description", "Untitled Action"
            )
            priority_data.append(
                [
                    item.get("priority", "medium").title(),
                    item.get("status", "pending").replace("_", " ").title(),
                    action_text[:50] + ("..." if len(action_text) > 50 else ""),
                    item.get("due_date", "Not set") or "Not set",
                ]
            )

        priority_table = Table(
            priority_data, colWidths=[0.8 * inch, 1 * inch, 3.2 * inch, 1 * inch]
        )
        priority_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors_dict["warning"]),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors_dict["bg_alt"]],
                    ),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        elements.append(priority_table)
        elements.append(Spacer(1, 20))

    # Detailed descriptions
    if active_items:
        elements.append(Paragraph("Detailed Action Items", styles["SectionTitle"]))

        for i, item in enumerate(active_items, 1):
            title_text = item.get("title") or item.get("description", "Untitled Action")
            elements.append(Paragraph(f"{i}. {title_text}", styles["SubSection"]))

            description = item.get("description", "")
            if description and description != title_text:
                elements.append(Paragraph(description, styles["ReportBody"]))

            elements.append(
                Paragraph(
                    f"Priority: {item.get('priority', 'medium').title()} | "
                    f"Status: {item.get('status', 'pending').replace('_', ' ').title()} | "
                    f"Due: {item.get('due_date', 'Not set') or 'Not set'}",
                    styles["SmallText"],
                )
            )
            elements.append(Spacer(1, 10))

    # Completed items
    if completed:
        elements.append(Paragraph("Completed Items", styles["SectionTitle"]))

        completed_data = [["Action Item", "Completed"]]
        for item in completed[-10:]:
            action_text = item.get("title") or item.get(
                "description", "Untitled Action"
            )
            completed_data.append(
                [
                    action_text[:60] + ("..." if len(action_text) > 60 else ""),
                    (
                        item.get("updated_at", "Unknown")[:10]
                        if item.get("updated_at")
                        else "Unknown"
                    ),
                ]
            )

        completed_table = Table(completed_data, colWidths=[5 * inch, 1 * inch])
        completed_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors_dict["success"]),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors_dict["border"]),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors_dict["bg_alt"]],
                    ),
                ]
            )
        )
        elements.append(completed_table)

    # No items message
    if not action_items:
        elements.append(
            Paragraph(
                "No action items have been created yet. Use the AI Advisor feature to get "
                "personalized recommendations for your retirement plan.",
                styles["ReportBody"],
            )
        )

    # Disclaimer
    elements.extend(create_disclaimer(styles))

    doc.build(elements)
    buffer.seek(0)
    return buffer
