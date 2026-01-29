/**
 * Financial calculation utilities
 * Provides consistent calculations for net worth, debts, and other financial metrics
 */

/**
 * Calculate net worth from assets
 * Net Worth = Total Assets - Total Debts
 */
export function calculateNetWorth(assets) {
    if (!assets) return { netWorth: 0, totalAssets: 0, totalDebts: 0 };

    const sumAssets = (arr) => (arr || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);
    const sumDebts = (arr) => (arr || []).reduce((sum, a) => sum + (a.mortgage_balance || 0), 0);

    // Calculate total asset values
    const retirementAssets = sumAssets(assets.retirement_accounts);
    const taxableAssets = sumAssets(assets.taxable_accounts);
    const realEstateAssets = sumAssets(assets.real_estate);
    const educationAssets = sumAssets(assets.education_accounts);
    const otherAssets = sumAssets(assets.other_assets) + educationAssets;
    const totalAssets = retirementAssets + taxableAssets + realEstateAssets + otherAssets;

    // Calculate total debts (mortgage balances + other liabilities)
    const mortgageDebts = sumDebts(assets.real_estate);
    const otherLiabilities = (assets.liabilities || []).reduce((sum, l) => sum + (l.value || 0), 0);
    const totalDebts = mortgageDebts + otherLiabilities;

    // Net worth = assets - debts
    const netWorth = totalAssets - totalDebts;

    return {
        netWorth,
        totalAssets,
        totalDebts,
        breakdown: {
            retirementAssets,
            taxableAssets,
            realEstateAssets: realEstateAssets - mortgageDebts, // Real estate equity
            realEstateGross: realEstateAssets,
            mortgageDebts,
            otherLiabilities,
            otherAssets
        }
    };
}

/**
 * Calculate liquid assets (easily accessible cash)
 */
export function calculateLiquidAssets(assets) {
    if (!assets) return 0;
    return (assets.taxable_accounts || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);
}

/**
 * Calculate retirement assets
 */
export function calculateRetirementAssets(assets) {
    if (!assets) return 0;
    return (assets.retirement_accounts || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);
}

/**
 * Calculate real estate equity (market value - mortgage balance)
 */
export function calculateRealEstateEquity(assets) {
    if (!assets || !assets.real_estate) return 0;

    return assets.real_estate.reduce((sum, property) => {
        const value = property.value || property.current_value || 0;
        const mortgage = property.mortgage_balance || 0;
        return sum + (value - mortgage);
    }, 0);
}

/**
 * Calculate total debts
 */
export function calculateTotalDebts(assets) {
    if (!assets) return 0;

    const mortgages = (assets.real_estate || []).reduce((sum, property) => {
        return sum + (property.mortgage_balance || 0);
    }, 0);

    const otherLiabilities = (assets.liabilities || []).reduce((sum, liability) => {
        return sum + (liability.value || 0);
    }, 0);

    return mortgages + otherLiabilities;
}

/**
 * Calculate portfolio-wide asset allocation (Stocks, Bonds, Cash)
 * Returns percentages as decimals (0.0 to 1.0)
 */
export function calculateAllocation(assets) {
    if (!assets) return { stocks: 0.6, bonds: 0.4, cash: 0 }; // Default 60/40

    let totalVal = 0;
    let totalStockVal = 0;
    let totalBondVal = 0;
    let totalCashVal = 0;

    const processCategory = (items) => {
        if (!items) return;
        items.forEach(item => {
            const val = item.value || item.current_value || 0;
            if (val <= 0) return;

            totalVal += val;
            
            const type = (item.type || '').toLowerCase();

            // Use provided percentages or defaults based on account type
            let s = item.stock_pct !== undefined ? item.stock_pct : 
                    (['brokerage', '401k', '403b', 'traditional_ira', 'roth_ira', 'sep_ira', 'simple_ira', 'ira', '401a'].includes(type) ? 0.6 : 0);
            let b = item.bond_pct !== undefined ? item.bond_pct : 
                    (['brokerage', '401k', '403b', 'traditional_ira', 'roth_ira', 'sep_ira', 'simple_ira', 'ira', '401a'].includes(type) ? 0.4 : 0);
            let c = item.cash_pct !== undefined ? item.cash_pct : 
                    (['savings', 'checking', 'cash', 'cd', 'money_market', 'brokerage_cash'].includes(type) ? 1.0 : 0);

            // If it's a known growth account but no % provided and type matching failed above, default to 60/40
            const isGrowthAccount = ['brokerage', '401k', '403b', 'traditional_ira', 'roth_ira', 'sep_ira', 'simple_ira', 'ira', '401a'].includes(type);
            if (isGrowthAccount && s === 0 && b === 0 && c === 0) {
                s = 0.6;
                b = 0.4;
            }

            // Normalize if sum > 1.0
            const sum = s + b + c;
            if (sum > 0) {
                totalStockVal += val * (s / sum);
                totalBondVal += val * (b / sum);
                totalCashVal += val * (c / sum);
            } else {
                // Default to cash if no allocation provided
                totalCashVal += val;
            }
        });
    };

    processCategory(assets.retirement_accounts);
    processCategory(assets.taxable_accounts);
    processCategory(assets.education_accounts);
    processCategory(assets.other_assets);

    if (totalVal === 0) return { stocks: 0.6, bonds: 0.4, cash: 0 };

    return {
        stocks: totalStockVal / totalVal,
        bonds: totalBondVal / totalVal,
        cash: totalCashVal / totalVal
    };
}

/**
 * Calculate debt-to-asset ratio
 */
export function calculateDebtToAssetRatio(assets) {
    const { totalAssets, totalDebts } = calculateNetWorth(assets);
    if (totalAssets === 0) return 0;
    return (totalDebts / totalAssets) * 100; // Return as percentage
}
