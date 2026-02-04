"""
Financial calculation utility functions.
"""

from typing import Dict, Any, List

def calculate_mortgage_payment(principal: float, annual_interest_rate: float, loan_term_years: int) -> float:
    """Calculates the monthly mortgage payment."""
    if annual_interest_rate == 0:
        return principal / (loan_term_years * 12)
    
    monthly_interest_rate = annual_interest_rate / 12
    number_of_payments = loan_term_years * 12
    
    # M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1]
    # M = monthly payment
    # P = principal loan amount
    # i = monthly interest rate
    # n = number of payments
    
    if (1 + monthly_interest_rate)**number_of_payments - 1 == 0:
        return 0 # Avoid division by zero for extremely long terms/zero interest
        
    return principal * (monthly_interest_rate * (1 + monthly_interest_rate)**number_of_payments) / 
           ((1 + monthly_interest_rate)**number_of_payments - 1)

def project_future_value(present_value: float, annual_growth_rate: float, years: int) -> float:
    """Projects future value of an investment or asset."""
    return present_value * ((1 + annual_growth_rate)**years)

def calculate_net_worth(assets: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculates net worth and a breakdown of asset categories.
    
    Args:
        assets (Dict[str, Any]): A dictionary of asset categories, each containing a list of asset dicts.
                                  Assumes each asset dict has a 'value' and optionally 'loan_balance' for real estate.
    Returns:
        Dict[str, float]: Contains 'netWorth' and individual category totals.
    """
    retirement_assets = sum(asset.get('value', 0) for asset in assets.get('retirement_accounts', []))
    taxable_assets = sum(asset.get('value', 0) for asset in assets.get('taxable_accounts', []))
    
    real_estate_assets = 0
    for prop in assets.get('real_estate', []):
        value = prop.get('value', 0)
        loan_balance = prop.get('loan_balance', 0)
        real_estate_assets += (value - loan_balance) # Equity

    other_assets = sum(asset.get('value', 0) for asset in assets.get('other_assets', []))
    
    total_liabilities = sum(asset.get('value', 0) for asset in assets.get('liabilities', [])) # Assuming 'value' is negative or represents debt amount
    
    # Pensions and annuities are typically income streams, not direct assets for net worth calculation
    
    total_assets = retirement_assets + taxable_assets + real_estate_assets + other_assets
    net_worth = total_assets - total_liabilities
    
    return {
        "netWorth": net_worth,
        "breakdown": {
            "retirementAssets": retirement_assets,
            "taxableAssets": taxable_assets,
            "realEstateAssets": real_estate_assets, # This is equity
            "otherAssets": other_assets,
            "totalLiabilities": total_liabilities
        }
    }

def calculate_total(items: List[Dict[str, Any]], field1: str = 'value', field2: str = None) -> float:
    """Calculates the total value for an array of items based on specified fields."""
    if not items or not isinstance(items, list):
        return 0
    return sum(item.get(field1, item.get(field2, 0) if field2 else 0) for item in items)
