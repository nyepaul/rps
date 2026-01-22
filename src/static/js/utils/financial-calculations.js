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
    const otherAssets = sumAssets(assets.other_assets);
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
 * Calculate debt-to-asset ratio
 */
export function calculateDebtToAssetRatio(assets) {
    const { totalAssets, totalDebts } = calculateNetWorth(assets);
    if (totalAssets === 0) return 0;
    return (totalDebts / totalAssets) * 100; // Return as percentage
}
