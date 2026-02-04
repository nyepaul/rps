/**
 * Frontend financial calculation utility functions.
 */

/**
 * Calculates net worth and a breakdown of asset categories.
 *
 * @param {object} assets - A dictionary of asset categories, each containing a list of asset objects.
 *                          Assumes each asset object has a 'value' and optionally 'loan_balance' for real estate.
 * @returns {object} Contains 'netWorth' and individual category totals.
 */
export function calculateNetWorth(assets) {
    const retirementAssets = (assets.retirement_accounts || []).reduce((sum, asset) => sum + (asset.value || 0), 0);
    const taxableAssets = (assets.taxable_accounts || []).reduce((sum, asset) => sum + (asset.value || 0), 0);
    
    let realEstateEquity = 0;
    (assets.real_estate || []).forEach(prop => {
        const value = prop.value || 0;
        const loanBalance = prop.loan_balance || 0;
        realEstateEquity += (value - loanBalance); // Equity
    });

    const otherAssets = (assets.other_assets || []).reduce((sum, asset) => sum + (asset.value || 0), 0);
    
    const totalLiabilities = (assets.liabilities || []).reduce((sum, liability) => sum + (liability.value || 0), 0);
    
    const totalAssets = retirementAssets + taxableAssets + realEstateEquity + otherAssets;
    const netWorth = totalAssets - totalLiabilities;
    
    return {
        netWorth: netWorth,
        breakdown: {
            retirementAssets: retirementAssets,
            taxableAssets: taxableAssets,
            realEstateAssets: realEstateEquity, // This is equity
            otherAssets: otherAssets,
            totalLiabilities: totalLiabilities
        }
    };
}

/**
 * Calculates the total value for an array of items based on specified fields.
 * @param {Array<object>} items - Array of objects.
 * @param {string} [field1='value'] - The primary field to sum.
 * @param {string} [field2=null] - A fallback field to sum if field1 is not present.
 * @returns {number} The total sum.
 */
export function calculateTotal(items, field1 = 'value', field2 = null) {
    if (!items || !Array.isArray(items)) {
        return 0;
    }
    return items.reduce((sum, item) => {
        const value = item[field1] || (field2 ? item[field2] : 0) || 0;
        return sum + value;
    }, 0);
}
