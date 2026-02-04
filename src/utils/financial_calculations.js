/**
 * Frontend financial calculation utility functions.
 */

import { APP_CONFIG } from '../config.js'; // Assuming APP_CONFIG is in ../config.js
// calculateAllocation is not defined in this file, assuming it's imported elsewhere or needs to be provided
// For now, I'll include a placeholder or expect it to be passed
// import { calculateAllocation } from './some_other_financial_util.js'; 
import { calculateAllocation } from './financial_calculations.js'; // Assuming calculateAllocation is in this file

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

/**
 * Check if an expense/income item is active on a given date
 */
export function isExpenseActiveOnDate(expense, checkDate) {
    // If ongoing or no date constraints, it's always active
    if (expense.ongoing !== false || (!expense.start_date && !expense.end_date)) {
        return true;
    }

    const check = checkDate.getTime();

    // Check start date
    if (expense.start_date) {
        const start = new Date(expense.start_date).getTime();
        if (check < start) {
            return false; // Before start date
        }
    }

    // Check end date
    if (expense.end_date) {
        const end = new Date(expense.end_date).getTime();
        if (check > end) {
            return false; // After end date
        }
    }

    return true;
}

/**
 * Calculate total monthly expenses for a specific period (current or future)
 */
export function calculatePeriodExpenses(budget, period, currentDate) {
    let expenses = 0;

    if (!budget.expenses || !budget.expenses[period]) {
        return expenses;
    }

    // All expense categories
    const categories = ['housing', 'utilities', 'transportation', 'food', 'dining_out', 'healthcare', 'insurance',
                      'travel', 'entertainment', 'personal_care', 'clothing', 'gifts', 'childcare_education',
                      'charitable_giving', 'subscriptions', 'pet_care', 'home_maintenance', 'debt_payments',
                      'taxes', 'discretionary', 'other'];

    categories.forEach(category => {
        const catData = budget.expenses[period][category];

        if (!catData) {
            return; // Skip if no data for this category
        }

        // Handle both array format (multiple instances) and legacy single object format
        const expenseItems = Array.isArray(catData) ? catData : [catData];

        expenseItems.forEach(expense => {
            // Check if expense is active on this date
            if (!isExpenseActiveOnDate(expense, currentDate)) {
                return; // Skip inactive expenses
            }

            const amount = expense.amount || 0;
            const frequency = expense.frequency || 'monthly';

            // Convert to monthly
            if (frequency === 'monthly') {
                expenses += amount;
            } else if (frequency === 'quarterly') {
                expenses += amount / 3;
            } else if (frequency === 'annual') {
                expenses += amount / 12;
            }
        });
    });

    return expenses;
}

/**
 * Calculate total monthly income from budget categories for a specific period (current or future)
 */
export function calculatePeriodIncome(budget, period, currentDate) {
    let income = 0;

    if (!budget.income || !budget.income[period]) {
        return income;
    }

    // Income categories that can have multiple items with start/end dates
    const categories = ['rental_income', 'part_time_consulting', 'business_income', 'other_income'];

    categories.forEach(category => {
        const items = budget.income[period][category] || [];
        if (!Array.isArray(items)) return;

        items.forEach(item => {
            // Check if this income item is active on this date
            if (!isExpenseActiveOnDate(item, currentDate)) {
                return; // Skip inactive income
            }

            const amount = item.amount || 0;
            const frequency = item.frequency || 'monthly';

            // Convert to monthly
            if (frequency === 'monthly') {
                income += amount;
            } else if (frequency === 'quarterly') {
                income += amount / 3;
            } else if (frequency === 'annual') {
                income += amount / 12;
            }
        });
    });

    return income;
}

/**
 * Calculate portfolio value by account type for withdrawal strategy
 */
export function calculatePortfolioByType(assets) {
    if (!assets) return { taxable: 0, taxDeferred: 0, roth: 0 };

    let taxable = 0;
    let taxDeferred = 0;
    let roth = 0;

    // Taxable accounts (withdraw first - most tax efficient)
    if (assets.taxable_accounts) {
        assets.taxable_accounts.forEach(account => {
            taxable += account.value || account.current_value || 0;
        });
    }

    // Retirement accounts - separate into tax-deferred and Roth
    if (assets.retirement_accounts) {
        assets.retirement_accounts.forEach(account => {
            const value = account.value || account.current_value || 0;
            const accountType = (account.type || '').toLowerCase();
            const accountName = (account.name || '').toLowerCase();

            // Roth accounts (withdraw last - tax-free growth)
            if (accountType.includes('roth') || accountName.includes('roth')) {
                roth += value;
            } else {
                // Tax-deferred (withdraw second - Traditional IRA, 401k, etc.)
                taxDeferred += value;
            }
        });
    }

    // Other assets (HSA, Crypto, etc.)
    if (assets.other_assets) {
        assets.other_assets.forEach(asset => {
            const value = asset.value || asset.current_value || 0;
            const type = (asset.type || '').toLowerCase();
            
            if (type === 'hsa') {
                roth += value; // HSA treated like Roth (tax-free out)
            } else {
                taxable += value; // Most others treated as taxable
            }
        });
    }

    return { taxable, taxDeferred, roth };
}

/**
 * Calculate monthly cash flow data with portfolio growth projection
 */
export function calculateMonthlyCashFlow(profile, months, marketScenario = 'balanced') {
    const data = profile.data || {};
    const incomeStreams = data.income_streams || [];
    const financial = data.financial || {};
    const budget = data.budget || {};
    const assets = data.assets || {};

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get retirement date
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    // Get withdrawal strategy settings
    const withdrawalStrategy = data.withdrawal_strategy || {};
    const annualWithdrawalRate = withdrawalStrategy.withdrawal_rate || 0.04; // Default to 4%

    // Calculate portfolio value by account type for proper withdrawal ordering
    const portfolioByType = calculatePortfolioByType(assets);
    let currentPortfolio = portfolioByType.taxable + portfolioByType.taxDeferred + portfolioByType.roth;

    // --- Market-Scenario-Aware Assumptions ---
    const marketProfile = APP_CONFIG.MARKET_PROFILES[marketScenario] || APP_CONFIG.MARKET_PROFILES['balanced'];
    
    // Get user's ACTUAL allocation from their assets
    const userAlloc = calculateAllocation(data.assets);
    const hasAssets = (portfolioByType.taxable + portfolioByType.taxDeferred + portfolioByType.roth) > 0;

    // Calculate blended growth rate
    // If user has assets, use their REAL mix for Stocks/Bonds/Cash.
    // If not, use the scenario's suggested mix.
    const stockAllocation = hasAssets ? userAlloc.stocks : (marketProfile.stock_allocation || 0.6);
    const bondAllocation = hasAssets ? userAlloc.bonds : (marketProfile.bond_allocation || 0.4);
    const cashAllocation = hasAssets ? userAlloc.cash : (marketProfile.cash_allocation || 0.0);
    
    // Other asset classes (REITs, Gold, Crypto) - use scenario targets as these are often "tactical" 
    const reitAllocation = marketProfile.reit_allocation || 0.0;
    const goldAllocation = marketProfile.gold_allocation || 0.0;
    const cryptoAllocation = marketProfile.crypto_allocation || 0.0;
    
    const annualGrowthRate = 
        (stockAllocation * (marketProfile.stock_return_mean || 0.10)) + 
        (bondAllocation * (marketProfile.bond_return_mean || 0.04)) +
        (cashAllocation * (marketProfile.cash_return_mean || 0.015)) +
        (reitAllocation * (marketProfile.reit_return_mean || 0.08)) +
        (goldAllocation * (marketProfile.gold_return_mean || 0.04)) +
        (cryptoAllocation * (marketProfile.crypto_return_mean || 0.20));
    
    const monthlyGrowthRate = annualGrowthRate / 12;
    const monthlyInflationRate = (marketProfile.inflation_mean || 0.03) / 12;

    const monthlyData = [];
    let cumulativeInflation = 1.0;  // Track cumulative inflation multiplier

    for (let i = 0; i < months; i++) {
        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + i);

        const monthLabel = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const dateStr = currentDate.toISOString().split('T')[0];

        // Apply inflation (compounds each month)
        cumulativeInflation *= (1 + monthlyInflationRate);

        // Check for retired
        const isRetired = retirementDate && currentDate >= retirementDate;

        // Check for Home Sales (liquidation events)
        let liquidationProceeds = 0;
        const homeProperties = data.home_properties || [];
        homeProperties.forEach(prop => {
            if (prop.planned_sale_date) {
                const saleDate = new Date(prop.planned_sale_date);
                if (saleDate.getFullYear() === currentDate.getFullYear() && 
                    saleDate.getMonth() === currentDate.getMonth()) {
                    
                    const currentVal = (prop.current_value || 0) * Math.pow(1 + (prop.appreciation_rate || marketProfile.inflation_mean), i / 12);
                    const mortgage = prop.mortgage_balance || 0;
                    const costs = currentVal * 0.06;
                    const gain = currentVal - (prop.purchase_price || currentVal);
                    const exclusion = prop.property_type === 'Primary Residence' ? 500000 : 0;
                    const taxableGain = Math.max(0, gain - exclusion);
                    const ltcgTax = taxableGain * 0.15;
                    const netProceeds = currentVal - mortgage - costs - ltcgTax;
                    const available = netProceeds - (prop.replacement_value || 0);
                    
                    liquidationProceeds += Math.max(0, available);
                }
            }
        });

        // Calculate work income for this month (from income_streams)
        let workIncome = 0;
        incomeStreams.forEach(stream => {
            const streamStart = stream.start_date ? new Date(stream.start_date) : null;
            const streamEnd = stream.end_date ? new Date(stream.end_date) : null;

            // Check if this income stream is active in this month
            const isActive = (!streamStart || currentDate >= streamStart) &&
                           (!streamEnd || currentDate <= streamEnd);

            if (isActive) {
                workIncome += stream.amount || 0;
            }
        });

        // Calculate additional income from budget with retirement blending
        // (rental, consulting, business, other income)
        let budgetIncome = 0;
        if (budget.income && (budget.income.current || budget.income.future)) {
            // Determine retirement status for both people
            const person1Retired = retirementDate && currentDate >= retirementDate;
            const spouseRetirementDate = data.spouse?.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const person2Retired = spouseRetirementDate && currentDate >= spouseRetirementDate;

            // Calculate retirement weight
            let retirementWeight = 0.0;
            if (person1Retired) retirementWeight += 0.5;
            if (person2Retired) retirementWeight += 0.5;

            // Calculate budget income based on retirement status
            if (retirementWeight === 0) {
                // Both working - use current income
                budgetIncome = calculatePeriodIncome(budget, 'current', currentDate);
            } else if (retirementWeight === 1.0) {
                // Both retired - use future income
                budgetIncome = calculatePeriodIncome(budget, 'future', currentDate);
            } else {
                // Transition period (one retired) - blend 50/50
                const currentIncome = calculatePeriodIncome(budget, 'current', currentDate);
                const futureIncome = calculatePeriodIncome(budget, 'future', currentDate);
                budgetIncome = (currentIncome * 0.5) + (futureIncome * 0.5);
            }
        }

        // Calculate retirement benefits (Social Security, Pension)
        // Track separately for proper tax calculation
        let retirementBenefits = 0;
        let p1SocialSecurity = 0;
        let p1Pension = 0;
        let p2SocialSecurity = 0;
        let p2Pension = 0;

        // --- Person 1 Social Security (based on claiming age) ---
        const p1ClaimingAge = financial.ss_claiming_age || 67;
        const p1BirthDate = profile.birth_date ? new Date(profile.birth_date) : null;
        let p1SSStarted = false;

        if (p1BirthDate) {
            const p1SSDate = new Date(p1BirthDate);
            p1SSDate.setFullYear(p1SSDate.getFullYear() + p1ClaimingAge);
            p1SSStarted = currentDate >= p1SSDate;
        } else {
            // Fallback to retirement date if birth date missing
            p1SSStarted = isRetired;
        }

        if (p1SSStarted) {
            p1SocialSecurity = financial.social_security_benefit || 0;
            retirementBenefits += p1SocialSecurity;
        }

        // Pension always starts at retirement
        if (isRetired) {
            p1Pension = financial.pension_benefit || 0;
            retirementBenefits += p1Pension;
        }

        // --- Person 2 (spouse) Social Security ---
        if (data.spouse) {
            const p2ClaimingAge = data.spouse.ss_claiming_age || 67;
            const p2BirthDate = data.spouse.birth_date ? new Date(data.spouse.birth_date) : null;
            let p2SSStarted = false;

            if (p2BirthDate) {
                const p2SSDate = new Date(p2BirthDate);
                p2SSDate.setFullYear(p2SSDate.getFullYear() + p2ClaimingAge);
                p2SSStarted = currentDate >= p2SSDate;
            } else {
                const spouseRetirementDate = data.spouse.retirement_date ? new Date(data.spouse.retirement_date) : null;
                p2SSStarted = spouseRetirementDate && currentDate >= spouseRetirementDate;
            }

            if (p2SSStarted) {
                p2SocialSecurity = data.spouse.social_security_benefit || 0;
                retirementBenefits += p2SocialSecurity;
            }

            // Spouse pension starts at their retirement
            const spouseRetirementDate = data.spouse.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const spouseIsRetired = spouseRetirementDate && currentDate >= spouseRetirementDate;
            if (spouseIsRetired) {
                p2Pension = data.spouse.pension_benefit || 0;
                retirementBenefits += p2Pension;
            }
        }

        // Get expenses from budget with retirement blending
        // Blended Budget Logic (matching backend retirement_model.py):
        // Both working -> 100% current
        // One retired -> 50% current / 50% future
        // Both retired -> 100% future
        let expenses = 0;

        // IMPORTANT: Prioritize financial.annual_expenses if provided (more accurate)
        if (financial.annual_expenses) {
            // Use the summary field - it's the source of truth
            expenses = financial.annual_expenses / 12;
        } else if (budget.expenses && (budget.expenses.current || budget.expenses.future)) {
            // Fallback to detailed budget categories only if annual_expenses not provided
            // Determine retirement status for both people
            const person1Retired = retirementDate && currentDate >= retirementDate;

            // Check if there's a spouse and their retirement date
            const spouseRetirementDate = data.spouse?.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const person2Retired = spouseRetirementDate && currentDate >= spouseRetirementDate;

            // Calculate retirement weight
            let retirementWeight = 0.0;
            if (person1Retired) retirementWeight += 0.5;
            if (person2Retired) retirementWeight += 0.5;

            // Calculate expenses based on retirement status
            if (retirementWeight === 0) {
                // Both working - use current expenses
                expenses = calculatePeriodExpenses(budget, 'current', currentDate);
            } else if (retirementWeight === 1.0) {
                // Both retired - use future expenses
                expenses = calculatePeriodExpenses(budget, 'future', currentDate);
            } else {
                // Transition period (one retired) - blend 50/50
                const currentExpenses = calculatePeriodExpenses(budget, 'current', currentDate);
                const futureExpenses = calculatePeriodExpenses(budget, 'future', currentDate);
                expenses = (currentExpenses * 0.5) + (futureExpenses * 0.5);
            }

            // Apply cumulative inflation to expenses
            expenses *= cumulativeInflation;
        }

        // Combine work income and budget income (rental, consulting, business, other)
        const totalWorkIncome = workIncome + budgetIncome;

        // Calculate investment income needed
        // After retirement (either person), we withdraw to cover shortfall between expenses and other income
        let investmentIncome = 0;

        // Check if anyone is retired
        const spouseRetirementDate = data.spouse?.retirement_date ? new Date(data.spouse.retirement_date) : null;
        const spouseIsRetired = spouseRetirementDate && currentDate >= spouseRetirementDate;
        const anyoneRetired = isRetired || spouseIsRetired;

        if (anyoneRetired) {
            const otherIncome = totalWorkIncome + retirementBenefits;
            const shortfall = expenses - otherIncome;

            // Only withdraw if there's a shortfall and we have portfolio
            if (shortfall > 0 && currentPortfolio > 0) {
                // Use the configured withdrawal rate, but cap at actual need and available portfolio
                const maxWithdrawal = (currentPortfolio * annualWithdrawalRate) / 12;
                investmentIncome = Math.min(shortfall, maxWithdrawal);

                // Deduct withdrawal from portfolio
                currentPortfolio -= investmentIncome;
            }
        }

        // Apply portfolio growth (returns on remaining portfolio after withdrawals)
        // Only apply growth if not retired or if portfolio still has value
        if (currentPortfolio > 0) {
            const monthlyGrowth = currentPortfolio * monthlyGrowthRate;
            currentPortfolio += monthlyGrowth;
        }

        // --- Realistic Tax Calculation for Chart ---
        // (Uses profile tax settings if available)
        let monthlyFederalTax = 0;
        let monthlyStateTax = 0;
        let monthlyFicaTax = 0;

        const fedRate = financial.tax_bracket_federal || 0.12; // Use 12% as a more realistic baseline for retirees
        const stateRate = financial.tax_bracket_state || 0.05;
        const ficaRate = 0.0765;

        // FICA only on work income (salary - not rental/business income)
        monthlyFicaTax = workIncome * ficaRate;

        // Income stacking for Federal/State (All income: Work + Budget + Pension + SS taxable portion)
        // SS taxation: rough rule of thumb (50% taxable for most)
        // Include both Person 1 and Person 2 (spouse) SS and pension
        const taxableSS = (p1SocialSecurity + p2SocialSecurity) * 0.5;
        const totalPension = p1Pension + p2Pension;

        // Investment income tax treatment: Split into basis return and capital gains
        // Assume 40% is return of basis (tax-free), 60% is long-term capital gains
        const investmentBasisReturn = investmentIncome * 0.4;  // Tax-free
        const investmentCapitalGains = investmentIncome * 0.6;  // Taxed at LTCG rates

        // Ordinary income (excludes investment gains - those are taxed separately)
        const monthlyTaxableOrdinary = totalWorkIncome + totalPension + taxableSS;

        // Apply standard deduction (monthly)
        const filingStatus = financial.filing_status || 'mfj';
        const stdDeductionMonthly = (filingStatus === 'mfj' ? 29200 : 14600) / 12;

        const taxableAfterDeduction = Math.max(0, monthlyTaxableOrdinary - stdDeductionMonthly);
        monthlyFederalTax = taxableAfterDeduction * fedRate;
        monthlyStateTax = taxableAfterDeduction * stateRate;

        // Long-term capital gains tax (stacked on ordinary income)
        // Use 0%, 15%, or 20% based on income level
        let ltcgTax = 0;
        if (investmentCapitalGains > 0) {
            // Simplified LTCG brackets for 2024 (most people fall in 15% bracket)
            const ltcgThreshold0 = (filingStatus === 'mfj' ? 94050 : 47025) / 12;  // Monthly 0% threshold
            const ltcgThreshold15 = (filingStatus === 'mfj' ? 583750 : 518900) / 12;  // Monthly 15%->20% threshold

            // Stack capital gains on top of ordinary income
            const totalIncomeForLTCG = monthlyTaxableOrdinary;

            if (totalIncomeForLTCG < ltcgThreshold0) {
                // 0% bracket
                const room = ltcgThreshold0 - totalIncomeForLTCG;
                const gainsAt0 = Math.min(investmentCapitalGains, room);
                const gainsAt15 = investmentCapitalGains - gainsAt0;
                ltcgTax = gainsAt15 * 0.15;
            } else if (totalIncomeForLTCG < ltcgThreshold15) {
                // 15% bracket
                ltcgTax = investmentCapitalGains * 0.15;
            } else {
                // 20% bracket
                ltcgTax = investmentCapitalGains * 0.20;
            }
        }

        // Add LTCG tax to federal tax
        monthlyFederalTax += ltcgTax;

        // --- 401k Retirement Contributions (Pre-retirement only) ---
        let monthly401kContribution = 0;
        let monthlyEmployerMatch = 0;

        if (!isRetired && workIncome > 0) {
            // Extract 401k rates from financial data
            const contributionRate = financial.annual_401k_contribution_rate || 0;
            const matchRate = financial.employer_match_rate || 0;

            // Calculate monthly contributions (401k is on salary only, not budget income)
            monthly401kContribution = workIncome * contributionRate;
            monthlyEmployerMatch = workIncome * matchRate;
        }

        // --- IRA Contributions (Pre-retirement only) ---
        let monthlyIRAContribution = 0;

        if (!isRetired) {
            // Extract annual IRA contribution from financial data
            const annualIRAContribution = financial.annual_ira_contribution || 0;
            monthlyIRAContribution = annualIRAContribution / 12;
        }

        // Total expenses including taxes
        const totalExpensesThisMonth = expenses + monthlyFederalTax + monthlyStateTax + monthlyFicaTax;
        const totalIncome = totalWorkIncome + retirementBenefits + investmentIncome + (liquidationProceeds || 0);

        // Calculate net cash flow AFTER subtracting retirement contributions
        // 401k is pre-tax, IRA is post-tax (both reduce take-home)
        const netCashFlow = totalIncome - totalExpensesThisMonth - monthly401kContribution - monthlyIRAContribution;

        // --- Update Portfolio Balance ---
        // Add surplus or subtract shortfall (remaining after withdrawals)
        currentPortfolio += netCashFlow;

        // Add liquidation proceeds (e.g. home sale) directly to portfolio
        currentPortfolio += liquidationProceeds;

        // Add 401k contributions (employee + employer match) to portfolio
        // These go into tax-deferred retirement accounts
        currentPortfolio += monthly401kContribution + monthlyEmployerMatch;

        // Add IRA contributions to portfolio (split between pre-tax and Roth)
        currentPortfolio += monthlyIRAContribution;

        // Floor portfolio at 0
        if (currentPortfolio < 0) currentPortfolio = 0;

        monthlyData.push({
            date: currentDate,
            label: monthLabel,
            workIncome: totalWorkIncome,  // Include all income (salary + rental + consulting + business + other)
            retirementBenefits,
            investmentIncome,
            totalIncome,
            expenses: totalExpensesThisMonth,
            federalTax: monthlyFederalTax,
            stateTax: monthlyStateTax,
            ficaTax: monthlyFicaTax,
            livingExpenses: expenses,
            netCashFlow,
            liquidationProceeds,
            portfolioValue: currentPortfolio,
            isRetired
        });
    }

    return monthlyData;
}

/**
 * Calculate portfolio value by account type for withdrawal strategy
 */
function calculatePortfolioByType(assets) {
    if (!assets) return { taxable: 0, taxDeferred: 0, roth: 0 };

    let taxable = 0;
    let taxDeferred = 0;
    let roth = 0;

    // Taxable accounts (withdraw first - most tax efficient)
    if (assets.taxable_accounts) {
        assets.taxable_accounts.forEach(account => {
            taxable += account.value || account.current_value || 0;
        });
    }

    // Retirement accounts - separate into tax-deferred and Roth
    if (assets.retirement_accounts) {
        assets.retirement_accounts.forEach(account => {
            const value = account.value || account.current_value || 0;
            const accountType = (account.type || '').toLowerCase();
            const accountName = (account.name || '').toLowerCase();

            // Roth accounts (withdraw last - tax-free growth)
            if (accountType.includes('roth') || accountName.includes('roth')) {
                roth += value;
            } else {
                // Tax-deferred (withdraw second - Traditional IRA, 401k, etc.)
                taxDeferred += value;
            }
        });
    }

    // Other assets (HSA, Crypto, etc.)
    if (assets.other_assets) {
        assets.other_assets.forEach(asset => {
            const value = asset.value || asset.current_value || 0;
            const type = (asset.type || '').toLowerCase();
            
            if (type === 'hsa') {
                roth += value; // HSA treated like Roth (tax-free out)
            } else {
                taxable += value; // Most others treated as taxable
            }
        });
    }

    return { taxable, taxDeferred, roth };
}

/**
 * Map scenario timeline data to chart data format
 */
function mapScenarioToChartData(timeline, chartData, viewType) {
    if (!timeline || !timeline.years || !timeline.median) {
        return null;
    }

    // Determine starting year of the chart data
    const firstChartYear = viewType === 'annual' 
        ? parseInt(chartData[0].label) 
        : chartData[0].date.getFullYear();
    const firstChartMonth = viewType === 'annual' 
        ? 0 
        : chartData[0].date.getMonth(); // 0-indexed month

    const mappedData = [];
    const monthlyCumulativeAdjustment = []; // For monthly view

    // Iterate through scenario's median values
    timeline.median.forEach((medianValue, index) => {
        // Calculate the corresponding year and month for the scenario data point
        const scenarioYear = timeline.years[index];
        const scenarioMonth = timeline.months ? timeline.months[index] - 1 : 0; // 0-indexed month

        // Find the matching data point in the primary chart data (if any)
        let chartDataPoint = null;
        if (viewType === 'annual') {
            chartDataPoint = chartData.find(d => parseInt(d.label) === scenarioYear);
        } else {
            chartDataPoint = chartData.find(d => 
                d.date.getFullYear() === scenarioYear && d.date.getMonth() === scenarioMonth
            );
        }

        if (chartDataPoint) {
            // Align scenario data to the existing chart data's years/months
            mappedData.push(medianValue);
            
            // For monthly view, calculate adjustment so that the scenario median starts
            // relative to the primary portfolio at the first chart data point's portfolio value.
            if (viewType === 'monthly' && index === 0) {
                const initialPrimaryPortfolio = chartDataPoint.portfolioValue;
                const initialScenarioPortfolio = medianValue;
                const adjustment = initialPrimaryPortfolio - initialScenarioPortfolio;
                monthlyCumulativeAdjustment.push(adjustment);
            } else if (viewType === 'monthly' && monthlyCumulativeAdjustment.length > 0) {
                monthlyCumulativeAdjustment.push(monthlyCumulativeAdjustment[monthlyCumulativeAdjustment.length - 1]);
            }

        } else if (mappedData.length > 0) {
            // If the scenario data extends beyond the current chart data, or starts earlier,
            // we need to pad with nulls or align carefully.
            // For simplicity, we'll start pushing data when chartData starts.
            mappedData.push(null);
        } else {
            // If scenario data starts before chart data, prepend nulls or align differently
            // For simplicity, we'll start pushing data when chartData starts.
            mappedData.push(null);
        }
    });

    // If in monthly view, apply cumulative adjustment
    if (viewType === 'monthly' && monthlyCumulativeAdjustment.length > 0) {
        return mappedData.map((val, index) => 
            val !== null && monthlyCumulativeAdjustment[index] !== undefined 
            ? val + monthlyCumulativeAdjustment[index] 
            : val
        );
    }

    return mappedData;
}

/**
 * Aggregate monthly data to annual data
 */
function aggregateToAnnual(monthlyData) {
    const annualData = [];
    let currentYear = null;
    let annualEntry = null;

    monthlyData.forEach(monthData => {
        const year = monthData.date.getFullYear();

        if (year !== currentYear) {
            if (annualEntry) {
                annualData.push(annualEntry);
            }
            currentYear = year;
            annualEntry = {
                date: new Date(year, 0, 1),
                label: year.toString(),
                workIncome: 0,
                retirementBenefits: 0,
                investmentIncome: 0,
                totalIncome: 0,
                expenses: 0,
                federalTax: 0,
                stateTax: 0,
                ficaTax: 0,
                livingExpenses: 0,
                netCashFlow: 0,
                liquidationProceeds: 0,
                portfolioValue: 0, // Will be replaced by year-end value
                isRetired: monthData.isRetired // Use status at year end
            };
        }

        annualEntry.workIncome += monthData.workIncome;
        annualEntry.retirementBenefits += monthData.retirementBenefits;
        annualEntry.investmentIncome += monthData.investmentIncome;
        annualEntry.totalIncome += monthData.totalIncome;
        annualEntry.expenses += monthData.expenses;
        annualEntry.federalTax += monthData.federalTax;
        annualEntry.stateTax += monthData.stateTax;
        annualEntry.ficaTax += monthData.ficaTax;
        annualEntry.livingExpenses += monthData.livingExpenses;
        annualEntry.netCashFlow += monthData.netCashFlow;
        annualEntry.liquidationProceeds += monthData.liquidationProceeds;
        annualEntry.portfolioValue = monthData.portfolioValue; // Take last month's portfolio value for year-end

        // Ensure isRetired is correctly carried forward if it changes mid-year
        if (monthData.isRetired) {
            annualEntry.isRetired = true;
        }
    });

    if (annualEntry) {
        annualData.push(annualEntry);
    }

    return annualData;
}