"""Chart generation for PDF reports."""

import io
import os
import tempfile
import matplotlib

matplotlib.use("Agg")  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np

from .base import format_currency


def create_success_rates_chart(scenarios, output_path=None):
    """Create bar chart of success rates.

    Args:
        scenarios: Dict with scenario data (conservative, moderate, aggressive)
        output_path: Path to save chart (creates temp file if None)

    Returns:
        Path to saved chart image
    """
    fig, ax = plt.subplots(figsize=(8, 4), facecolor="white")

    scenario_names = []
    success_rates = []
    colors_list = []

    for key in ["conservative", "moderate", "aggressive"]:
        scenario = scenarios.get(key, {})
        scenario_names.append(scenario.get("scenario_name", key.title()))
        rate = scenario.get("success_rate", 0)
        success_rates.append(rate)

        # Color based on success rate
        if rate >= 90:
            colors_list.append("#2e7d32")  # Green
        elif rate >= 75:
            colors_list.append("#f57c00")  # Orange
        else:
            colors_list.append("#c62828")  # Red

    bars = ax.bar(
        scenario_names,
        success_rates,
        color=colors_list,
        alpha=0.8,
        edgecolor="#1a237e",
        linewidth=2,
    )

    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height,
            f"{height:.1f}%",
            ha="center",
            va="bottom",
            fontsize=12,
            fontweight="bold",
        )

    # Add target line at 90%
    ax.axhline(
        y=90,
        color="#2e7d32",
        linestyle="--",
        linewidth=2,
        alpha=0.5,
        label="Target: 90%",
    )

    ax.set_ylabel("Success Rate (%)", fontsize=12, fontweight="bold")
    ax.set_title(
        "Retirement Plan Success Rates by Scenario",
        fontsize=14,
        fontweight="bold",
        pad=20,
    )
    ax.set_ylim(0, 110)
    ax.grid(axis="y", alpha=0.3, linestyle="--")
    ax.legend(loc="upper right")

    plt.tight_layout()

    if output_path is None:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            output_path = tmp.name

    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close()

    return output_path


def create_portfolio_projection_chart(scenarios, output_path=None):
    """Create line chart of portfolio projections over time.

    Args:
        scenarios: Dict with scenario data including timeline
        output_path: Path to save chart (creates temp file if None)

    Returns:
        Path to saved chart image
    """
    fig, ax = plt.subplots(figsize=(8, 5), facecolor="white")

    # Plot each scenario
    for key, color, label in [
        ("conservative", "#1a237e", "Conservative (30% stocks)"),
        ("moderate", "#0277bd", "Moderate (60% stocks)"),
        ("aggressive", "#00acc1", "Aggressive (80% stocks)"),
    ]:
        scenario = scenarios.get(key, {})
        timeline = scenario.get("timeline", {})
        years = timeline.get("years", [])
        median = timeline.get("median", [])

        if years and median:
            ax.plot(
                years,
                [v / 1000 for v in median],
                color=color,
                linewidth=2.5,
                label=label,
                alpha=0.8,
            )

    ax.set_xlabel("Year", fontsize=12, fontweight="bold")
    ax.set_ylabel("Portfolio Value ($K)", fontsize=12, fontweight="bold")
    ax.set_title(
        "Projected Portfolio Balance Over Time (Median Outcome)",
        fontsize=14,
        fontweight="bold",
        pad=20,
    )
    ax.grid(True, alpha=0.3, linestyle="--")
    ax.legend(loc="best", framealpha=0.9)

    # Format y-axis
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f"${x:.0f}K"))

    plt.tight_layout()

    if output_path is None:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            output_path = tmp.name

    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close()

    return output_path


def create_probability_distribution_chart(scenario_data, output_path=None):
    """Create histogram of ending wealth distribution.

    Args:
        scenario_data: Dict with percentile data (percentile_5, median_ending_wealth, percentile_95)
        output_path: Path to save chart (creates temp file if None)

    Returns:
        Path to saved chart image
    """
    fig, ax = plt.subplots(figsize=(8, 4), facecolor="white")

    # Generate distribution data from percentiles
    p5 = scenario_data.get("percentile_5", 0)
    median = scenario_data.get("median_ending_wealth", 0)
    p95 = scenario_data.get("percentile_95", 0)

    # Approximate log-normal distribution from percentiles
    if p5 > 0 and median > 0 and p95 > 0:
        mu = np.log(median)
        sigma = (np.log(p95) - np.log(p5)) / 3.29  # 3.29 ≈ 2 * 1.645 (90% range)
        data = np.random.lognormal(mu, sigma, 1000)
        data = data[(data >= p5 * 0.5) & (data <= p95 * 1.5)]  # Trim outliers
    else:
        data = []

    if len(data) > 0:
        ax.hist(data / 1000, bins=40, color="#0277bd", alpha=0.7, edgecolor="#1a237e")

        # Add percentile lines
        ax.axvline(
            p5 / 1000,
            color="#c62828",
            linestyle="--",
            linewidth=2,
            label=f"5th: {format_currency(p5, abbreviated=True)}",
        )
        ax.axvline(
            median / 1000,
            color="#2e7d32",
            linestyle="-",
            linewidth=2.5,
            label=f"Median: {format_currency(median, abbreviated=True)}",
        )
        ax.axvline(
            p95 / 1000,
            color="#00acc1",
            linestyle="--",
            linewidth=2,
            label=f"95th: {format_currency(p95, abbreviated=True)}",
        )

        ax.set_xlabel("Ending Portfolio Value ($K)", fontsize=12, fontweight="bold")
        ax.set_ylabel("Frequency", fontsize=12, fontweight="bold")
        ax.set_title(
            "Distribution of Retirement Outcomes",
            fontsize=14,
            fontweight="bold",
            pad=20,
        )
        ax.legend(loc="upper right", framealpha=0.9)
        ax.grid(axis="y", alpha=0.3, linestyle="--")

    plt.tight_layout()

    if output_path is None:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            output_path = tmp.name

    plt.savefig(output_path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close()

    return output_path


def create_value_over_time_chart(monthly_values, output_path=None):
    """Create a line chart showing portfolio value over time.

    Args:
        monthly_values: List of monthly portfolio values
        output_path: Path to save chart (creates temp file if None)

    Returns:
        Path to saved chart image
    """
    fig, ax = plt.subplots(figsize=(5.5, 2.5))

    months = list(range(1, 13))
    if len(monthly_values) < 12:
        monthly_values = monthly_values + [
            monthly_values[-1] if monthly_values else 0
        ] * (12 - len(monthly_values))

    ax.plot(months, monthly_values[:12], linewidth=2, color="#003057")
    ax.fill_between(months, monthly_values[:12], alpha=0.1, color="#003057")

    ax.set_xlabel("Month", fontsize=8, fontweight="bold")
    ax.set_ylabel("Portfolio Value ($)", fontsize=8, fontweight="bold")
    ax.set_title("Value over time", fontsize=10, fontweight="bold", loc="left")

    ax.grid(True, alpha=0.3, linestyle="--", linewidth=0.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#DEDEDE")
    ax.spines["bottom"].set_color("#DEDEDE")

    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f"${x:,.0f}"))
    ax.tick_params(labelsize=8)

    plt.tight_layout()

    if output_path is None:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            output_path = tmp.name

    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    return output_path


def create_portfolio_pie_chart(asset_allocation, output_path=None):
    """Create a portfolio allocation pie chart.

    Args:
        asset_allocation: Dict mapping asset names to values
        output_path: Path to save chart (creates temp file if None)

    Returns:
        Path to saved chart image
    """
    fig, ax = plt.subplots(figsize=(3, 3))

    labels = list(asset_allocation.keys())
    sizes = list(asset_allocation.values())
    colors_list = ["#003057", "#757575", "#DEDEDE", "#C79E5B", "#006E7F"]

    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        autopct="%1.1f%%",
        colors=colors_list[: len(labels)],
        startangle=90,
        textprops={"fontsize": 8},
    )

    for autotext in autotexts:
        autotext.set_color("white")
        autotext.set_fontweight("bold")
        autotext.set_fontsize(9)

    ax.set_title("Current Portfolio", fontsize=10, fontweight="bold", pad=10)
    plt.tight_layout()

    if output_path is None:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            output_path = tmp.name

    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    return output_path


def cleanup_chart_files(file_paths):
    """Clean up temporary chart files.

    Args:
        file_paths: List of file paths to delete
    """
    for path in file_paths:
        try:
            if path and os.path.exists(path):
                os.unlink(path)
        except Exception:
            pass  # Ignore cleanup errors
