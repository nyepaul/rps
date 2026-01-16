"""Service for generating automated action items based on financial profile."""
from datetime import datetime, timedelta
from typing import List, Dict, Any
from src.models.action_item import ActionItem
from src.models.profile import Profile


class ActionItemService:
    """Service for generating recommendations and tasks."""

    @staticmethod
    def generate_for_profile(user_id: int, profile: Profile) -> List[ActionItem]:
        """Analyze profile and generate relevant action items."""
        items = []
        data = profile.data_dict
        financial = data.get('financial', {})
        assets = data.get('assets', {})
        
        # 1. Age-based rules
        birth_date_str = profile.birth_date
        if birth_date_str:
            birth_date = datetime.fromisoformat(birth_date_str)
            age = (datetime.now() - birth_date).days // 365
            
            # Social Security Planning
            if 55 <= age <= 70:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Retirement',
                    description='Optimize Social Security claiming strategy. Analyze the impact of claiming at 62 vs 67 vs 70.',
                    priority='high' if age >= 62 else 'medium',
                    due_date=(datetime.now() + timedelta(days=90)).isoformat()
                ))
            
            # Medicare Planning
            if 63 <= age <= 65:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Healthcare',
                    description='Research Medicare options and supplement plans. Plan for enrollment at age 65.',
                    priority='high',
                    due_date=(datetime.now() + timedelta(days=60)).isoformat()
                ))

            # Catch-up contributions
            if age >= 50:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Savings',
                    description='Take advantage of catch-up contributions for 401(k) and IRA accounts.',
                    priority='medium'
                ))

        # 2. Asset-based rules
        retirement_accounts = assets.get('retirement_accounts', [])
        taxable_accounts = assets.get('taxable_accounts', [])
        
        total_retirement = sum(a.get('value', 0) for a in retirement_accounts)
        total_liquid = sum(a.get('value', 0) for a in taxable_accounts)
        
        # Emergency fund check
        annual_expenses = financial.get('annual_expenses', 0)
        if annual_expenses > 0:
            monthly_expenses = annual_expenses / 12
            if total_liquid < (monthly_expenses * 3):
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Savings',
                    description=f'Build emergency fund to at least 3-6 months of expenses (${int(monthly_expenses * 6):,}). Currently have ${int(total_liquid):,}.',
                    priority='high'
                ))

        # 3. Family-based rules
        spouse = data.get('spouse', {})
        children = data.get('children', [])
        
        if children or spouse:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Estate',
                description='Review and update estate planning documents (Will, Power of Attorney, Healthcare Proxy) and beneficiary designations.',
                priority='medium'
            ))

        if children:
            has_young_children = any(c.get('age', 25) < 22 for c in children)
            if has_young_children:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Education',
                    description='Review college savings strategies (e.g., 529 plans) for children.',
                    priority='medium'
                ))

        # 4. Net Worth / Complexity rules
        real_estate_value = sum(a.get('value', 0) for a in assets.get('real_estate', []))
        total_assets = total_retirement + total_liquid + real_estate_value

        if total_assets > 1000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Tax',
                description='High net worth detected. Consider advanced tax optimization strategies like tax-loss harvesting or charitable giving vehicles.',
                priority='medium'
            ))

        # Estate planning for high net worth
        if total_assets > 2000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Estate',
                description='Consider setting up a revocable living trust to avoid probate and streamline estate administration.',
                priority='high',
                due_date=(datetime.now() + timedelta(days=180)).isoformat()
            ))

        # Federal estate tax planning
        if total_assets > 13610000:  # 2024 federal estate tax exemption
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Estate',
                description='Estate may be subject to federal estate taxes. Consult with estate planning attorney about advanced strategies (ILIT, GRATs, family partnerships).',
                priority='high',
                due_date=(datetime.now() + timedelta(days=90)).isoformat()
            ))

        # Gift planning
        if total_assets > 5000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Tax',
                description='Review annual gifting strategy. You can gift up to $18,000 per recipient ($36,000 for married couples) without using lifetime exemption.',
                priority='medium'
            ))

        # Inherited IRA planning (if they have large IRAs)
        if total_retirement > 500000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Inheritance',
                description='Review beneficiary designations on retirement accounts. Consider naming a trust or using conduit trust for minor beneficiaries.',
                priority='high',
                due_date=(datetime.now() + timedelta(days=120)).isoformat()
            ))

        # RMD planning for those approaching 73
        if birth_date_str:
            age = (datetime.now() - datetime.fromisoformat(birth_date_str)).days // 365
            if 70 <= age <= 73:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Tax',
                    description='Plan for Required Minimum Distributions (RMDs) starting at age 73. Consider Qualified Charitable Distributions (QCDs) if charitably inclined.',
                    priority='high',
                    due_date=(datetime.now() + timedelta(days=90)).isoformat()
                ))

        # Charitable giving planning
        if total_assets > 3000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Tax',
                description='Consider establishing a donor-advised fund (DAF) or private foundation for tax-efficient charitable giving.',
                priority='low'
            ))

        # Life insurance estate planning
        if total_assets > 5000000 and (spouse or children):
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Estate',
                description='Review life insurance policies. Consider Irrevocable Life Insurance Trust (ILIT) to remove policy proceeds from taxable estate.',
                priority='medium'
            ))

        # Real estate inheritance planning
        if real_estate_value > 500000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Inheritance',
                description='Review real estate holdings and consider step-up in basis planning. Discuss transfer strategies (TOD deed, trust, joint ownership) with estate attorney.',
                priority='medium'
            ))

        # Business succession planning (inferred if high net worth with income)
        annual_income = financial.get('annual_income', 0)
        if annual_income > 500000 and total_assets > 5000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Estate',
                description='If you own a business, ensure business succession plan is documented and funded. Consider buy-sell agreements and key person insurance.',
                priority='high',
                due_date=(datetime.now() + timedelta(days=180)).isoformat()
            ))

        # Healthcare directives
        if birth_date_str:
            age = (datetime.now() - datetime.fromisoformat(birth_date_str)).days // 365
            if age >= 55:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Estate',
                    description='Ensure healthcare directives are in place: Living Will, Healthcare Power of Attorney, and HIPAA authorization forms.',
                    priority='high',
                    due_date=(datetime.now() + timedelta(days=90)).isoformat()
                ))

        # Digital asset estate planning
        if total_assets > 1000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Estate',
                description='Create digital asset inventory and include access instructions in estate plan (online accounts, cryptocurrencies, social media).',
                priority='low'
            ))

        # State estate tax planning (for high net worth in certain states)
        if total_assets > 3000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Tax',
                description='Check state estate tax thresholds for your state. Some states have exemptions as low as $1M. Consider state residency planning if applicable.',
                priority='medium'
            ))

        # Roth conversion planning for tax optimization
        if total_retirement > 500000 and birth_date_str:
            age = (datetime.now() - datetime.fromisoformat(birth_date_str)).days // 365
            if 55 <= age < 73:
                items.append(ActionItem(
                    user_id=user_id,
                    profile_id=profile.id,
                    category='Tax',
                    description='Analyze Roth conversion opportunities before RMDs begin. Multi-year conversion strategy could reduce lifetime taxes and increase tax-free inheritance.',
                    priority='medium',
                    due_date=(datetime.now() + timedelta(days=120)).isoformat()
                ))

        # 5. Default "Missing Data" items (The "Fix Wizard" logic can also use this)
        if not financial.get('annual_expenses'):
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Profile',
                description='Complete your expense profile in the Budget tab for more accurate retirement projections.',
                priority='high'
            ))

        return items

    @staticmethod
    def sync_generated_items(user_id: int, profile: Profile):
        """Generate and save items if they don't already exist (avoiding duplicates)."""
        new_items = ActionItemService.generate_for_profile(user_id, profile)
        existing_items = ActionItem.list_by_user(user_id, profile.id)
        
        existing_descriptions = {item.description for item in existing_items}
        
        for item in new_items:
            if item.description not in existing_descriptions:
                item.save()
