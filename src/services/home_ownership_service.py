"""
Service for performing 'Rent vs. Own' financial analysis.
Calculates and compares the financial outcomes of renting versus owning a primary residence.
"""

from typing import Dict, Any, List
from datetime import date
from src.utils.financial_calculations import calculate_mortgage_payment, project_future_value


class HomeOwnershipService:
    def __init__(self, profile_data: Dict[str, Any]):
        self.profile_data = profile_data
        self.home_asset = profile_data.get('home_asset', {})

    def _get_owning_params(self, scenario_params: Dict[str, Any]) -> Dict[str, Any]:
        """Combines default home asset data with scenario overrides for owning."""
        owning_defaults = {
            "purchase_price": self.home_asset.get("purchase_price", 0),
            "down_payment_pct": self.home_asset.get("down_payment", 0) / (self.home_asset.get("purchase_price") or 1) if self.home_asset.get("purchase_price") else 0,
            "mortgage_term_years": self.home_asset.get("loan_term_years", 30),
            "interest_rate_pct": self.home_asset.get("interest_rate", 0),
            "property_tax_rate_pct": self.home_asset.get("property_tax_rate", 0),
            "home_insurance_annual": self.home_asset.get("home_insurance_annual", 0),
            "maintenance_annual_pct": self.home_asset.get("maintenance_annual_pct", 0),
            "appreciation_annual_pct": self.home_asset.get("appreciation_annual_pct", 0.03),
            "closing_costs_pct": scenario_params.get("own_scenario", {}).get("closing_costs_pct", 0.03) # Default closing costs if not in home_asset
        }
        # Override with scenario-specific parameters
        owning_params = {**owning_defaults, **scenario_params.get("own_scenario", {})}
        
        # Ensure calculated fields are set if missing from home_asset but derivable
        if "loan_amount" not in owning_params and owning_params["purchase_price"] and owning_params["down_payment_pct"]:
             owning_params["loan_amount"] = owning_params["purchase_price"] * (1 - owning_params["down_payment_pct"])
        
        return owning_params

    def _get_renting_params(self, scenario_params: Dict[str, Any]) -> Dict[str, Any]:
        """Combines default home asset data with scenario overrides for renting."""
        renting_defaults = {
            "initial_monthly_rent": self.home_asset.get("initial_rent_pm", 0),
            "annual_rent_increase_pct": self.home_asset.get("rent_increase_annual_pct", 0.03)
        }
        return {**renting_defaults, **scenario_params.get("rent_scenario", {})}

    def analyze_scenario(self, scenario_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes a rent vs. own scenario.
        :param scenario_params: Dictionary containing scenario-specific parameters.
        :return: Dictionary with analysis results.
        """
        time_horizon_years = scenario_params.get("time_horizon_years", 10)
        opportunity_cost_return = scenario_params.get("opportunity_cost_investment_return_pct", 0.07)

        owning_data = self._get_owning_params(scenario_params)
        renting_data = self._get_renting_params(scenario_params)

        results_own = self._calculate_owning_costs_and_equity(owning_data, time_horizon_years)
        results_rent = self._calculate_renting_costs(renting_data, time_horizon_years)
        
        # Calculate opportunity cost of down payment and closing costs
        initial_owning_cash_outlay = (
            owning_data["purchase_price"] * owning_data["down_payment_pct"] + 
            owning_data["purchase_price"] * owning_data["closing_costs_pct"]
        )

        opportunity_gain = project_future_value(initial_owning_cash_outlay, opportunity_cost_return, time_horizon_years) - initial_owning_cash_outlay
        
        net_worth_own = results_own["ending_equity"] # equity already includes home value minus mortgage
        net_worth_rent = initial_owning_cash_outlay + opportunity_gain # cash not spent, invested

        # Total costs
        total_owning_costs = (
            results_own["total_mortgage_payments"] + results_own["total_property_tax"] + 
            results_own["total_insurance"] + results_own["total_maintenance"] + 
            owning_data["purchase_price"] * owning_data["closing_costs_pct"]
        )
        total_renting_costs = results_rent["total_rent_payments"]

        return {
            "time_horizon_years": time_horizon_years,
            "own_scenario": {
                "initial_cash_outlay": initial_owning_cash_outlay,
                "total_costs": total_owning_costs,
                "ending_home_value": results_own["ending_home_value"],
                "ending_equity": results_own["ending_equity"],
                "net_worth_contribution": net_worth_own,
                "monthly_cash_flow_impact_start": results_own["monthly_piti"] + results_own["monthly_maintenance"],
                "total_interest_paid": results_own["total_interest_paid"]
            },
            "rent_scenario": {
                "initial_monthly_rent": renting_data["initial_monthly_rent"],
                "total_costs": total_renting_costs,
                "opportunity_investment_gain": opportunity_gain,
                "net_worth_contribution": net_worth_rent,
                "monthly_cash_flow_impact_start": renting_data["initial_monthly_rent"]
            },
            "summary": {
                "net_worth_difference": net_worth_own - net_worth_rent,
                "total_cost_difference": total_owning_costs - total_renting_costs,
                "recommendation": "Own" if (net_worth_own - net_worth_rent) > 0 else "Rent",
                "time_horizon_years": time_horizon_years,
            }
        }

    def _calculate_owning_costs_and_equity(self, params: Dict[str, Any], time_horizon_years: int) -> Dict[str, Any]:
        """Calculates total owning costs and equity over the time horizon."""
        
        # Ensure loan_amount is present
        if "loan_amount" not in params:
            params["loan_amount"] = params["purchase_price"] * (1 - params["down_payment_pct"])

        monthly_piti = calculate_mortgage_payment(
            params["loan_amount"],
            params["interest_rate_pct"],
            params["mortgage_term_years"]
        )
        
        annual_property_tax = params["purchase_price"] * params["property_tax_rate_pct"]
        annual_maintenance = params["purchase_price"] * params["maintenance_annual_pct"]
        
        # Proper remaining balance using amortization formula:
        # balance = P * [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
        monthly_rate = params["interest_rate_pct"] / 12
        N = params["mortgage_term_years"] * 12  # total payments
        n = min(time_horizon_years * 12, N)     # payments made by horizon

        if monthly_rate > 0:
            factor = (1 + monthly_rate) ** N
            remaining_balance = params["loan_amount"] * (factor - (1 + monthly_rate) ** n) / (factor - 1)
        else:
            remaining_balance = max(0.0, params["loan_amount"] - (params["loan_amount"] / N) * n)
        remaining_balance = max(0.0, remaining_balance)
        principal_paid = params["loan_amount"] - remaining_balance

        actual_payments = min(time_horizon_years, params["mortgage_term_years"]) * 12
        total_mortgage_payments = monthly_piti * actual_payments
        total_property_tax = annual_property_tax * time_horizon_years
        total_insurance = params["home_insurance_annual"] * time_horizon_years
        total_maintenance = annual_maintenance * time_horizon_years

        ending_home_value = project_future_value(params["purchase_price"], params["appreciation_annual_pct"], time_horizon_years)
        ending_equity = ending_home_value - remaining_balance

        return {
            "monthly_piti": monthly_piti,
            "monthly_maintenance": annual_maintenance / 12,
            "total_mortgage_payments": total_mortgage_payments,
            "total_property_tax": total_property_tax,
            "total_insurance": total_insurance,
            "total_maintenance": total_maintenance,
            "ending_home_value": ending_home_value,
            "ending_equity": ending_equity,
            "total_interest_paid": total_mortgage_payments - principal_paid,
        }

    def _calculate_renting_costs(self, params: Dict[str, Any], time_horizon_years: int) -> Dict[str, Any]:
        """Calculates total renting costs over the time horizon."""
        total_rent_payments = 0
        current_monthly_rent = params["initial_monthly_rent"]
        annual_rent_increase_rate = 1 + params["annual_rent_increase_pct"]

        for year in range(time_horizon_years):
            total_rent_payments += current_monthly_rent * 12
            current_monthly_rent *= annual_rent_increase_rate
        
        return {
            "total_rent_payments": total_rent_payments
        }

# Helper for financial calculations that might be in src/utils/financial_calculations.py
# If these don't exist, they would need to be added to src/utils/financial_calculations.py
# For now, I'll include them as placeholders or import if they are in src/utils/financial_calculations.py

# Placeholder if not already existing in src/utils/financial_calculations.py
# In a real scenario, I would check and add these to the utility file.
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
    
    return (principal * (monthly_interest_rate * (1 + monthly_interest_rate)**number_of_payments) / 
            ((1 + monthly_interest_rate)**number_of_payments - 1))

def project_future_value(present_value: float, annual_growth_rate: float, years: int) -> float:
    """Projects future value of an investment or asset."""
    return present_value * ((1 + annual_growth_rate)**years)

