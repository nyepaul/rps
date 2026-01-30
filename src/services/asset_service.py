"""Asset management service for profile data synchronization and CSV operations."""

import csv
import io
from typing import Dict, List, Any
from datetime import datetime


def sync_legacy_arrays(data: dict) -> dict:
    """
    Synchronize new assets structure to legacy investment_types/home_properties arrays.
    Maintains backward compatibility with v1 model.

    Args:
        data: Profile data dictionary

    Returns:
        Updated data dictionary with synced legacy arrays
    """
    assets = data.get("assets", {})

    # Build investment_types from retirement + taxable accounts
    investment_types = []

    for account in assets.get("retirement_accounts", []):
        investment_types.append(
            {
                "name": account.get("name", ""),
                "account": account.get("type", ""),
                "value": account.get("value", 0),
                "cost_basis": account.get("cost_basis", 0),
                "stock_pct": account.get("stock_pct", 0.6),
                "bond_pct": account.get("bond_pct", 0.4),
                "cash_pct": account.get("cash_pct", 0.0),
            }
        )

    for account in assets.get("taxable_accounts", []):
        investment_types.append(
            {
                "name": account.get("name", ""),
                "account": account.get("type", ""),
                "value": account.get("value", 0),
                "cost_basis": account.get("cost_basis", 0),
                "stock_pct": account.get("stock_pct", 0.6),
                "bond_pct": account.get("bond_pct", 0.4),
                "cash_pct": account.get("cash_pct", 0.0),
            }
        )

    data["investment_types"] = investment_types

    # Build home_properties from real_estate
    home_properties = []

    for prop in assets.get("real_estate", []):
        home_properties.append(
            {
                "name": prop.get("name", ""),
                "property_type": prop.get("type", ""),
                "current_value": prop.get("value", 0) or prop.get("current_value", 0),
                "purchase_price": prop.get("purchase_price", 0),
                "mortgage_balance": prop.get("mortgage_balance", 0),
                "annual_costs": prop.get("annual_costs", 0),
            }
        )

    data["home_properties"] = home_properties

    return data


def assets_to_csv(assets: dict) -> str:
    """
    Convert assets dictionary to CSV format.

    Args:
        assets: Assets dictionary from profile.data.assets

    Returns:
        CSV string
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(
        [
            "category",
            "name",
            "type",
            "institution",
            "value",
            "cost_basis",
            "account_number",
            "mortgage_balance",
            "annual_costs",
            "monthly_benefit",
            "start_date",
            "inflation_adjusted",
            "description",
            "stock_pct",
            "bond_pct",
            "cash_pct",
            "additional_data",
        ]
    )

    # Export retirement accounts
    for account in assets.get("retirement_accounts", []):
        writer.writerow(
            [
                "retirement",
                account.get("name", ""),
                account.get("type", ""),
                account.get("institution", ""),
                account.get("value", 0),
                account.get("cost_basis", 0),
                account.get("account_number", ""),
                "",  # mortgage_balance
                "",  # annual_costs
                "",  # monthly_benefit
                "",  # start_date
                "",  # inflation_adjusted
                "",  # description
                account.get("stock_pct", 0.6),
                account.get("bond_pct", 0.4),
                account.get("cash_pct", 0.0),
                "",  # additional_data
            ]
        )

    # Export taxable accounts
    for account in assets.get("taxable_accounts", []):
        writer.writerow(
            [
                "taxable",
                account.get("name", ""),
                account.get("type", ""),
                account.get("institution", ""),
                account.get("value", 0),
                account.get("cost_basis", 0),
                account.get("account_number", ""),
                "",  # mortgage_balance
                "",  # annual_costs
                "",  # monthly_benefit
                "",  # start_date
                "",  # inflation_adjusted
                "",  # description
                account.get("stock_pct", 0.6),
                account.get("bond_pct", 0.4),
                account.get("cash_pct", 0.0),
                "",  # additional_data
            ]
        )

    # Export real estate
    for prop in assets.get("real_estate", []):
        writer.writerow(
            [
                "real_estate",
                prop.get("name", ""),
                prop.get("type", ""),
                "",  # institution
                prop.get("value", 0) or prop.get("current_value", 0),
                prop.get("purchase_price", 0),
                "",  # account_number
                prop.get("mortgage_balance", 0),
                prop.get("annual_costs", 0),
                "",  # monthly_benefit
                "",  # start_date
                "",  # inflation_adjusted
                prop.get("address", ""),
                "",  # additional_data
            ]
        )

    # Export pensions and annuities
    for pension in assets.get("pensions_annuities", []):
        writer.writerow(
            [
                "pension_annuity",
                pension.get("name", ""),
                pension.get("type", ""),
                pension.get("provider", ""),
                "",  # value
                "",  # cost_basis
                "",  # account_number
                "",  # mortgage_balance
                "",  # annual_costs
                pension.get("monthly_benefit", 0),
                pension.get("start_date", ""),
                "true" if pension.get("inflation_adjusted", False) else "false",
                "",  # description
                "",  # additional_data
            ]
        )

    # Export other assets
    for other in assets.get("other_assets", []):
        writer.writerow(
            [
                "other",
                other.get("name", ""),
                other.get("type", ""),
                "",  # institution
                other.get("value", 0),
                "",  # cost_basis
                "",  # account_number
                "",  # mortgage_balance
                "",  # annual_costs
                "",  # monthly_benefit
                "",  # start_date
                "",  # inflation_adjusted
                other.get("description", ""),
                "",  # additional_data
            ]
        )

    return output.getvalue()


def csv_to_assets(csv_content: str) -> dict:
    """
    Parse CSV content and convert to assets dictionary.

    Args:
        csv_content: CSV string content

    Returns:
        Assets dictionary compatible with profile.data.assets structure

    Raises:
        ValueError: If CSV format is invalid
    """
    assets = {
        "retirement_accounts": [],
        "taxable_accounts": [],
        "real_estate": [],
        "pensions_annuities": [],
        "other_assets": [],
    }

    reader = csv.DictReader(io.StringIO(csv_content))

    # Validate required columns
    required_columns = {"category", "name", "type", "value"}
    if not required_columns.issubset(reader.fieldnames or []):
        raise ValueError(f"CSV must contain columns: {', '.join(required_columns)}")

    timestamp = datetime.utcnow().isoformat()

    for row_num, row in enumerate(reader, start=2):
        category = row.get("category", "").strip().lower()

        if not category:
            continue  # Skip empty rows

        try:
            if category == "retirement":
                assets["retirement_accounts"].append(
                    {
                        "name": row["name"].strip(),
                        "type": row["type"].strip(),
                        "institution": row.get("institution", "").strip(),
                        "account_number": row.get("account_number", "").strip(),
                        "value": float(row.get("value", 0) or 0),
                        "cost_basis": float(row.get("cost_basis", 0) or 0),
                        "stock_pct": float(row.get("stock_pct", 0.6) or 0.6),
                        "bond_pct": float(row.get("bond_pct", 0.4) or 0.4),
                        "cash_pct": float(row.get("cash_pct", 0.0) or 0),
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }
                )

            elif category == "taxable":
                assets["taxable_accounts"].append(
                    {
                        "name": row["name"].strip(),
                        "type": row["type"].strip(),
                        "institution": row.get("institution", "").strip(),
                        "account_number": row.get("account_number", "").strip(),
                        "value": float(row.get("value", 0) or 0),
                        "cost_basis": float(row.get("cost_basis", 0) or 0),
                        "stock_pct": float(row.get("stock_pct", 0.6) or 0.6),
                        "bond_pct": float(row.get("bond_pct", 0.4) or 0.4),
                        "cash_pct": float(row.get("cash_pct", 0.0) or 0),
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }
                )

            elif category == "real_estate":
                assets["real_estate"].append(
                    {
                        "name": row["name"].strip(),
                        "type": row["type"].strip(),
                        "value": float(row.get("value", 0) or 0),
                        "purchase_price": float(row.get("cost_basis", 0) or 0),
                        "mortgage_balance": float(row.get("mortgage_balance", 0) or 0),
                        "annual_costs": float(row.get("annual_costs", 0) or 0),
                        "address": row.get("description", "").strip(),
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }
                )

            elif category in ("pension_annuity", "pension", "annuity"):
                assets["pensions_annuities"].append(
                    {
                        "name": row["name"].strip(),
                        "type": row["type"].strip(),
                        "provider": row.get("institution", "").strip(),
                        "monthly_benefit": float(row.get("monthly_benefit", 0) or 0),
                        "start_date": row.get("start_date", "").strip(),
                        "inflation_adjusted": row.get("inflation_adjusted", "").lower()
                        == "true",
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }
                )

            elif category == "other":
                assets["other_assets"].append(
                    {
                        "name": row["name"].strip(),
                        "type": row["type"].strip(),
                        "value": float(row.get("value", 0) or 0),
                        "description": row.get("description", "").strip(),
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }
                )

            else:
                raise ValueError(f"Invalid category '{category}' at row {row_num}")

        except (ValueError, KeyError) as e:
            raise ValueError(f"Error parsing row {row_num}: {str(e)}")

    return assets


def merge_assets(existing_assets: dict, new_assets: dict) -> dict:
    """
    Merge new assets with existing assets (append, not replace).

    Args:
        existing_assets: Current assets dictionary
        new_assets: New assets to add

    Returns:
        Merged assets dictionary
    """
    merged = {
        "retirement_accounts": existing_assets.get("retirement_accounts", []).copy(),
        "taxable_accounts": existing_assets.get("taxable_accounts", []).copy(),
        "real_estate": existing_assets.get("real_estate", []).copy(),
        "pensions_annuities": existing_assets.get("pensions_annuities", []).copy(),
        "other_assets": existing_assets.get("other_assets", []).copy(),
    }

    # Append new assets to each category
    for category in merged.keys():
        merged[category].extend(new_assets.get(category, []))

    return merged
