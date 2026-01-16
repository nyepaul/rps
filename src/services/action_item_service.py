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
        total_assets = total_retirement + total_liquid + sum(a.get('value', 0) for a in assets.get('real_estate', []))
        if total_assets > 1000000:
            items.append(ActionItem(
                user_id=user_id,
                profile_id=profile.id,
                category='Tax',
                description='High net worth detected. Consider advanced tax optimization strategies like tax-loss harvesting or charitable giving vehicles.',
                priority='medium'
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
