/**
 * Financial Data tab - Complete calculation reference documentation
 */
import {
    glossaryTerm as renderGlossaryTerm,
    wireGlossaryTermClicks as wireGlossaryTerms,
} from '../../utils/glossary.js';

const FINANCIAL_GLOSSARY = {
    agi: { title: 'AGI', definition: 'Adjusted Gross Income used as a baseline for many tax calculations.' },
    magi: { title: 'MAGI', definition: 'Modified Adjusted Gross Income, often used for Medicare IRMAA brackets and eligibility thresholds.' },
    fica: { title: 'FICA', definition: 'Federal payroll taxes for Social Security and Medicare.' },
    medicare: { title: 'Medicare', definition: 'Federal health insurance program primarily for age 65+ and certain younger disabled individuals.' },
    irmaa: { title: 'IRMAA', definition: 'Income-Related Monthly Adjustment Amount; extra Medicare Part B/D premium charges at higher income levels.' },
    effective_rate: { title: 'Effective Tax Rate', definition: 'Average rate paid across all taxable income, not just the top marginal bracket.' },
    marginal_rate: { title: 'Marginal Tax Rate', definition: 'Tax rate applied to the next dollar of taxable income.' },
    ltcg: { title: 'LTCG', definition: 'Long-Term Capital Gains, typically taxed at preferential rates based on stacked taxable income.' },
    rmd: { title: 'RMD', definition: 'Required Minimum Distribution from certain retirement accounts, generally starting at age 73.' },
    pia: { title: 'PIA', definition: 'Primary Insurance Amount, baseline monthly Social Security benefit at full retirement age.' },
    aime: { title: 'AIME', definition: 'Average Indexed Monthly Earnings used in Social Security benefit formulas.' },
    fra: { title: 'FRA', definition: 'Full Retirement Age for Social Security benefit calculations.' }
};

function glossaryTerm(label, key) {
    return renderGlossaryTerm(label, key, { className: 'fd-glossary-term' });
}

function wireGlossaryTermClicks(root) {
    wireGlossaryTerms(root, FINANCIAL_GLOSSARY, { className: 'fd-glossary-term' });
}

const SECTIONS = [
    {
        id: 'monte-carlo',
        title: 'Monte Carlo Simulation',
        content: `
            <p>Runs <strong>10,000 simulations</strong> (configurable 100-50,000) using year-by-year vectorized NumPy operations. Each simulation draws random returns from a normal distribution for each asset class, then tracks all accounts, taxes, contributions, and withdrawals through the projection period.</p>

            <h4>Default Asset Class Parameters</h4>
            <table>
                <thead><tr><th>Asset Class</th><th>Mean Return</th><th>Std Dev</th><th>Default Allocation</th></tr></thead>
                <tbody>
                    <tr><td>Stocks</td><td>10.0%</td><td>18.0%</td><td>50%</td></tr>
                    <tr><td>Bonds</td><td>4.0%</td><td>6.0%</td><td>40%</td></tr>
                    <tr><td>Cash</td><td>1.5%</td><td>0.5%</td><td>10%</td></tr>
                    <tr><td>REITs</td><td>8.0%</td><td>15.0%</td><td>0%</td></tr>
                    <tr><td>Gold</td><td>4.0%</td><td>15.0%</td><td>0%</td></tr>
                    <tr><td>Crypto</td><td>20.0%</td><td>60.0%</td><td>0%</td></tr>
                    <tr><td>Inflation</td><td>3.0%</td><td>1.0%</td><td>n/a</td></tr>
                </tbody>
            </table>

            <h4>Portfolio Return</h4>
            <div class="formula">
                mean = &Sigma;(allocation<sub>i</sub> &times; return<sub>i</sub>)<br>
                variance = &Sigma;(alloc<sub>i</sub> &times; std<sub>i</sub>)<sup>2</sup> + 2 &times; stock_alloc &times; bond_alloc &times; 0.3 &times; stock_std &times; bond_std<br>
                annual_return = Normal(mean, &radic;variance)
            </div>
            <p>Stock-bond correlation is <strong>0.3</strong>. Other asset classes assume zero cross-correlation.</p>

            <h4>Dynamic Glide Path</h4>
            <p>After age 65, stock allocation reduces by 1% per year (floor: 20%). Reduction is reallocated to bonds.</p>

            <h4>Three Scenarios</h4>
            <table>
                <thead><tr><th>Scenario</th><th>Stocks</th><th>Bonds</th></tr></thead>
                <tbody>
                    <tr><td>Conservative</td><td>30%</td><td>70%</td></tr>
                    <tr><td>Moderate</td><td>60%</td><td>40%</td></tr>
                    <tr><td>Aggressive</td><td>80%</td><td>20%</td></tr>
                </tbody>
            </table>

            <h4>Success Rate</h4>
            <div class="formula">
                success_rate = count(ending_balance &gt; 0) / simulations
            </div>
            <p>Output includes median final balance, 10th/90th percentile paths, and year-by-year 5th/50th/95th percentile timelines.</p>
        `
    },
    {
        id: 'investment-returns',
        title: 'Investment Return Modeling',
        content: `
            <h4>Account-Specific Growth</h4>
            <table>
                <thead><tr><th>Account Type</th><th>Growth Formula</th><th>Notes</th></tr></thead>
                <tbody>
                    <tr><td>Cash / Savings</td><td>balance &times; (1 + 1.5%)</td><td>Fixed rate, no randomness</td></tr>
                    <tr><td>Taxable Brokerage</td><td>balance &times; (1 + return &times; 0.85)</td><td>15% tax drag on positive returns</td></tr>
                    <tr><td>Pre-Tax (401k/IRA)</td><td>balance &times; (1 + return)</td><td>Tax-deferred, full market returns</td></tr>
                    <tr><td>457b</td><td>balance &times; (1 + return)</td><td>Tax-deferred, full market returns</td></tr>
                    <tr><td>Roth</td><td>balance &times; (1 + return)</td><td>Tax-free growth</td></tr>
                </tbody>
            </table>

            <h4>Home Appreciation</h4>
            <div class="formula">
                appreciation = Normal(inflation_rate, 5%)<br>
                home_value = home_value &times; (1 + appreciation)
            </div>
            <p>Default appreciation rate equals the inflation mean (3%). Standard deviation fixed at 5%.</p>

            <h4>Inflation (CPI) Tracking</h4>
            <div class="formula">
                cpi starts at 1.0<br>
                each year: cpi = cpi &times; (1 + Normal(inflation_mean, inflation_std))
            </div>
            <p>All dollar-denominated values (expenses, deductions, brackets) are adjusted by the CPI multiplier.</p>
        `
    },
    {
        id: 'income-modeling',
        title: 'Income Modeling',
        content: `
            <h4>Employment Income</h4>
            <p>Aggregated from income streams (salary, hourly, wages, bonus) and budget employment categories. Stops at each person's retirement age.</p>

            <h4>Frequency Conversion</h4>
            <table>
                <thead><tr><th>Frequency</th><th>Annual Multiplier</th></tr></thead>
                <tbody>
                    <tr><td>Monthly</td><td>&times; 12</td></tr>
                    <tr><td>Weekly</td><td>&times; 52</td></tr>
                    <tr><td>Biweekly</td><td>&times; 26</td></tr>
                    <tr><td>Quarterly</td><td>&times; 4</td></tr>
                    <tr><td>Annual</td><td>&times; 1</td></tr>
                </tbody>
            </table>

            <h4>Social Security Income</h4>
            <div class="formula">
                gross_ss = (person1_monthly &times; 12 + person2_monthly &times; 12) &times; cpi
            </div>
            <p>Each person's SS begins when their age reaches their claiming age (default 67).</p>

            <h4>Pension Income</h4>
            <div class="formula">
                pension = annual_amount &times; cpi
            </div>
            <p>Activates when the pension holder retires.</p>

            <h4>Budget Income Blending (Partial Retirement)</h4>
            <table>
                <thead><tr><th>Status</th><th>Blend</th></tr></thead>
                <tbody>
                    <tr><td>Both working</td><td>100% current-period income</td></tr>
                    <tr><td>Both retired</td><td>100% future-period income</td></tr>
                    <tr><td>One retired</td><td>50% current + 50% future</td></tr>
                </tbody>
            </table>
        `
    },
    {
        id: 'federal-tax',
        title: 'Federal Income Tax',
        content: `
            <h4>Taxable Income</h4>
            <div class="formula">
                taxable_income = max(0, gross_ordinary_income - standard_deduction)<br>
                federal_tax = &Sigma; min(remaining, bracket_width) &times; rate
            </div>

            <h4>2025 Tax Brackets -- Married Filing Jointly</h4>
            <table>
                <thead><tr><th>Rate</th><th>Income Range</th></tr></thead>
                <tbody>
                    <tr><td>10%</td><td>$0 - $23,850</td></tr>
                    <tr><td>12%</td><td>$23,850 - $96,950</td></tr>
                    <tr><td>22%</td><td>$96,950 - $206,700</td></tr>
                    <tr><td>24%</td><td>$206,700 - $394,600</td></tr>
                    <tr><td>32%</td><td>$394,600 - $501,050</td></tr>
                    <tr><td>35%</td><td>$501,050 - $751,600</td></tr>
                    <tr><td>37%</td><td>$751,600+</td></tr>
                </tbody>
            </table>

            <h4>2025 Tax Brackets -- Single</h4>
            <table>
                <thead><tr><th>Rate</th><th>Income Range</th></tr></thead>
                <tbody>
                    <tr><td>10%</td><td>$0 - $11,925</td></tr>
                    <tr><td>12%</td><td>$11,925 - $48,475</td></tr>
                    <tr><td>22%</td><td>$48,475 - $103,350</td></tr>
                    <tr><td>24%</td><td>$103,350 - $197,300</td></tr>
                    <tr><td>32%</td><td>$197,300 - $250,525</td></tr>
                    <tr><td>35%</td><td>$250,525 - $626,350</td></tr>
                    <tr><td>37%</td><td>$626,350+</td></tr>
                </tbody>
            </table>

            <h4>2025 Tax Brackets -- Head of Household</h4>
            <table>
                <thead><tr><th>Rate</th><th>Income Range</th></tr></thead>
                <tbody>
                    <tr><td>10%</td><td>$0 - $17,000</td></tr>
                    <tr><td>12%</td><td>$17,000 - $64,850</td></tr>
                    <tr><td>22%</td><td>$64,850 - $103,350</td></tr>
                    <tr><td>24%</td><td>$103,350 - $197,300</td></tr>
                    <tr><td>32%</td><td>$197,300 - $250,500</td></tr>
                    <tr><td>35%</td><td>$250,500 - $626,350</td></tr>
                    <tr><td>37%</td><td>$626,350+</td></tr>
                </tbody>
            </table>

            <h4>Standard Deduction (2025)</h4>
            <table>
                <thead><tr><th>Filing Status</th><th>Base</th><th>Age 65+ Additional</th></tr></thead>
                <tbody>
                    <tr><td>Single</td><td>$15,000</td><td>+$2,000</td></tr>
                    <tr><td>Married Filing Jointly</td><td>$30,000</td><td>+$1,600 per spouse</td></tr>
                    <tr><td>Head of Household</td><td>$22,500</td><td>+$2,000</td></tr>
                    <tr><td>Married Filing Separately</td><td>$15,000</td><td>+$1,600</td></tr>
                </tbody>
            </table>
            <p>Standard deduction is inflation-adjusted in the simulation: base &times; cpi</p>
        `
    },
    {
        id: 'fica',
        title: 'FICA Taxes',
        content: `
            <div class="formula">
                Social Security Tax = min(employment_income, $176,100) &times; 6.2%<br>
                ${glossaryTerm('Medicare', 'medicare')} Tax = employment_income &times; 1.45%<br>
                Total ${glossaryTerm('FICA', 'fica')} = SS Tax + Medicare Tax
            </div>
            <p>Social Security wage base for 2025: <strong>$176,100</strong>. Only employment income is subject to FICA.</p>
        `
    },
    {
        id: 'state-tax',
        title: 'State Income Tax',
        content: `
            <p>The Monte Carlo simulation uses a <strong>simplified flat rate</strong> (default 5%):</p>
            <div class="formula">
                state_tax = (employment_income + other_ordinary_income) &times; state_rate
            </div>

            <h4>Per-State Rates (Tax Optimization)</h4>
            <p>The tax optimization service uses actual state rates. Notable examples:</p>
            <table>
                <thead><tr><th>State</th><th>Rate</th><th>State</th><th>Rate</th></tr></thead>
                <tbody>
                    <tr><td>California</td><td>12.30%</td><td>Florida</td><td>0%</td></tr>
                    <tr><td>New York</td><td>10.90%</td><td>Texas</td><td>0%</td></tr>
                    <tr><td>New Jersey</td><td>10.75%</td><td>Nevada</td><td>0%</td></tr>
                    <tr><td>Illinois</td><td>4.95%</td><td>Washington</td><td>0%</td></tr>
                    <tr><td>Pennsylvania</td><td>3.07%</td><td>Tennessee</td><td>0%</td></tr>
                </tbody>
            </table>
            <p>Zero-tax states: AK, FL, NV, NH, SD, TN, TX, WA, WY</p>
        `
    },
    {
        id: 'ss-taxation',
        title: 'Social Security Taxation',
        content: `
            <h4>Provisional Income</h4>
            <div class="formula">
                provisional = ${glossaryTerm('AGI', 'agi')} (excluding SS) + 50% &times; SS Benefits + tax-exempt interest
            </div>

            <h4>Taxation Thresholds</h4>
            <table>
                <thead><tr><th>Filing Status</th><th>Threshold 1</th><th>Threshold 2</th></tr></thead>
                <tbody>
                    <tr><td>MFJ</td><td>$32,000</td><td>$44,000</td></tr>
                    <tr><td>Single / HoH</td><td>$25,000</td><td>$34,000</td></tr>
                </tbody>
            </table>

            <h4>Taxable Amount</h4>
            <div class="formula">
                If provisional &le; threshold_1:<br>
                &nbsp;&nbsp;taxable_ss = 0<br><br>
                If threshold_1 &lt; provisional &le; threshold_2:<br>
                &nbsp;&nbsp;taxable_ss = min(50% &times; SS, 50% &times; (provisional - threshold_1))<br><br>
                If provisional &gt; threshold_2:<br>
                &nbsp;&nbsp;base = 50% &times; (threshold_2 - threshold_1)<br>
                &nbsp;&nbsp;additional = 85% &times; (provisional - threshold_2)<br>
                &nbsp;&nbsp;taxable_ss = min(85% &times; SS, base + additional)
            </div>
            <p>Up to <strong>85%</strong> of Social Security benefits can be taxable depending on total income.</p>
        `
    },
    {
        id: 'ltcg',
        title: 'Long-Term Capital Gains Tax',
        content: `
            <p>${glossaryTerm('LTCG', 'ltcg')} rates are <strong>stacked on top of ordinary income</strong> to determine the applicable rate.</p>

            <h4>2025 LTCG Thresholds</h4>
            <table>
                <thead><tr><th>Filing Status</th><th>0% Up To</th><th>15% Up To</th><th>20% Above</th></tr></thead>
                <tbody>
                    <tr><td>MFJ</td><td>$96,700</td><td>$600,050</td><td>$600,050</td></tr>
                    <tr><td>Single</td><td>$48,350</td><td>$533,400</td><td>$533,400</td></tr>
                    <tr><td>HoH</td><td>$64,750</td><td>$566,700</td><td>$566,700</td></tr>
                </tbody>
            </table>

            <h4>Income Stacking Algorithm</h4>
            <div class="formula">
                room_at_0% = max(0, threshold_0 - ordinary_income)<br>
                gains_at_0% = min(gains, room_at_0%)<br>
                remaining = gains - gains_at_0%<br><br>
                room_at_15% = max(0, threshold_15 - max(ordinary_income, threshold_0))<br>
                gains_at_15% = min(remaining, room_at_15%)<br>
                gains_at_20% = remaining - gains_at_15%<br><br>
                LTCG_tax = gains_at_15% &times; 15% + gains_at_20% &times; 20%
            </div>
        `
    },
    {
        id: 'irmaa',
        title: 'Medicare IRMAA Surcharges',
        content: `
            <p>${glossaryTerm('IRMAA', 'irmaa')} uses a <strong>2-year ${glossaryTerm('MAGI', 'magi')} lookback</strong>.</p>

            <h4>2025 Annual Surcharges -- Married Filing Jointly</h4>
            <table>
                <thead><tr><th>MAGI Range</th><th>Annual Surcharge</th></tr></thead>
                <tbody>
                    <tr><td>$0 - $212,000</td><td>$0</td></tr>
                    <tr><td>$212,000 - $266,000</td><td>$888</td></tr>
                    <tr><td>$266,000 - $334,000</td><td>$2,231</td></tr>
                    <tr><td>$334,000 - $400,000</td><td>$3,575</td></tr>
                    <tr><td>$400,000 - $750,000</td><td>$4,919</td></tr>
                    <tr><td>$750,000+</td><td>$5,327</td></tr>
                </tbody>
            </table>

            <h4>2025 Annual Surcharges -- Single / MFS</h4>
            <table>
                <thead><tr><th>MAGI Range</th><th>Annual Surcharge</th></tr></thead>
                <tbody>
                    <tr><td>$0 - $106,000</td><td>$0</td></tr>
                    <tr><td>$106,000 - $133,000</td><td>$888</td></tr>
                    <tr><td>$133,000 - $167,000</td><td>$2,231</td></tr>
                    <tr><td>$167,000 - $200,000</td><td>$3,575</td></tr>
                    <tr><td>$200,000 - $500,000</td><td>$4,919</td></tr>
                    <tr><td>$500,000+</td><td>$5,327</td></tr>
                </tbody>
            </table>
            <p>For MFJ, surcharge is <strong>doubled</strong> if both spouses are on Medicare (both age 65+). MFS filers use single-filer thresholds per IRS rules.</p>
        `
    },
    {
        id: 'contributions',
        title: 'Retirement Account Contributions',
        content: `
            <h4>2025 IRS Contribution Limits</h4>
            <table>
                <thead><tr><th>Limit</th><th>Amount</th></tr></thead>
                <tbody>
                    <tr><td>401(k) Employee Deferral</td><td>$23,500</td></tr>
                    <tr><td>401(k) Catch-Up (age 50-59, 64+)</td><td>+$7,500</td></tr>
                    <tr><td>401(k) Super Catch-Up (age 60-63, SECURE 2.0)</td><td>+$11,250</td></tr>
                    <tr><td>IRA Base</td><td>$7,000</td></tr>
                    <tr><td>IRA Catch-Up (age 50+)</td><td>+$1,000</td></tr>
                    <tr><td>Section 415(c) Total</td><td>$70,000</td></tr>
                    <tr><td>Section 415(c) with Catch-Up</td><td>$77,500</td></tr>
                </tbody>
            </table>

            <h4>401(k) Contribution Formula</h4>
            <div class="formula">
                employee_contrib = salary &times; contribution_rate<br>
                limit = $23,500 (+ $11,250 if age 60-63; + $7,500 if age &ge; 50 otherwise)<br>
                employee_contrib = min(employee_contrib, limit)<br><br>
                employer_match = salary &times; match_rate<br>
                total_limit = $70,000 (or $77,500 if age &ge; 50)<br>
                employer_match = min(employer_match, total_limit - employee_contrib)
            </div>

            <h4>IRA Contributions</h4>
            <div class="formula">
                ira_limit = $7,000 (+ $1,000 if age &ge; 50)<br>
                if MFJ and both working: ira_limit &times;= 2<br>
                ira_contrib = min(user_amount, ira_limit)<br><br>
                Traditional IRA += ira_contrib &times; (1 - roth_split)<br>
                Roth IRA += ira_contrib &times; roth_split
            </div>
            <p>Default Roth split: 50%.</p>

            <h4>Surplus Allocation</h4>
            <p>After contributions and expenses, remaining cash flow is allocated:</p>
            <table>
                <thead><tr><th>Account</th><th>Default %</th></tr></thead>
                <tbody>
                    <tr><td>Pre-Tax</td><td>50%</td></tr>
                    <tr><td>Roth</td><td>30%</td></tr>
                    <tr><td>Taxable Brokerage</td><td>20%</td></tr>
                </tbody>
            </table>
        `
    },
    {
        id: 'withdrawal',
        title: 'Withdrawal Strategy',
        content: `
            <p>Tax-efficient waterfall. Each source is tapped in order until the annual shortfall is covered.</p>

            <h4>Withdrawal Order</h4>
            <table>
                <thead><tr><th>#</th><th>Source</th><th>Tax Treatment</th><th>Notes</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>Cash / Savings</td><td>Already taxed</td><td>No additional tax impact</td></tr>
                    <tr><td>2</td><td>457(b)</td><td>Ordinary income</td><td>No early withdrawal penalty (government plan)</td></tr>
                    <tr><td>3</td><td>Taxable Brokerage</td><td>Capital gains</td><td>LTCG rate stacked on ordinary income; gain ratio = (value - basis) / value</td></tr>
                    <tr><td>4</td><td>Pre-Tax (401k/IRA)</td><td>Ordinary income</td><td>10% penalty if age &lt; 59.5</td></tr>
                    <tr><td>5</td><td>Roth</td><td>Tax-free</td><td>Last resort, preserves tax-free growth</td></tr>
                </tbody>
            </table>

            <h4>Gross-Up Formula</h4>
            <div class="formula">
                gross_needed = shortfall / max(0.01, 1 - effective_tax_rate)<br>
                actual_withdrawal = min(gross_needed, account_balance)
            </div>
            <p>Withdrawals are grossed up to cover the taxes owed on the withdrawal itself.</p>

            <h4>Marginal Tax Stacking</h4>
            <div class="formula">
                tax_before = federal_tax(cumulative_income - deduction)<br>
                tax_after = federal_tax(cumulative_income + withdrawal - deduction)<br>
                actual_tax_on_withdrawal = tax_after - tax_before
            </div>
        `
    },
    {
        id: 'rmd',
        title: 'Required Minimum Distributions',
        content: `
            <div class="formula">
                ${glossaryTerm('RMD', 'rmd')} = pre-tax_balance / IRS_Uniform_Lifetime_Factor(age)
            </div>
            <p>Starting age: <strong>73</strong> (SECURE Act 2.0). RMDs are taxed as ordinary income.</p>

            <h4>IRS Uniform Lifetime Table (Excerpt)</h4>
            <table>
                <thead><tr><th>Age</th><th>Factor</th><th>Age</th><th>Factor</th><th>Age</th><th>Factor</th></tr></thead>
                <tbody>
                    <tr><td>73</td><td>26.5</td><td>80</td><td>20.2</td><td>90</td><td>12.2</td></tr>
                    <tr><td>74</td><td>25.5</td><td>82</td><td>18.5</td><td>92</td><td>10.8</td></tr>
                    <tr><td>75</td><td>24.6</td><td>84</td><td>16.8</td><td>95</td><td>8.9</td></tr>
                    <tr><td>76</td><td>23.7</td><td>86</td><td>15.2</td><td>100</td><td>6.4</td></tr>
                    <tr><td>78</td><td>22.0</td><td>88</td><td>13.7</td><td>120</td><td>2.0</td></tr>
                </tbody>
            </table>

            <h4>MFJ Split</h4>
            <p>For married couples where both are 73+, pre-tax balance is split 50/50. Each half uses the respective spouse's age factor.</p>
            <div class="formula">
                total_rmd = (balance / 2) / factor(p1_age) + (balance / 2) / factor(p2_age)
            </div>
            <p>Net RMD after tax covers shortfall first; remainder flows to taxable brokerage.</p>
        `
    },
    {
        id: 'social-security',
        title: 'Social Security Estimation',
        content: `
            <h4>${glossaryTerm('PIA', 'pia')} (Primary Insurance Amount) -- Bend Point Formula</h4>
            <div class="formula">
                ${glossaryTerm('AIME', 'aime')} = annual_employment_income / 12<br><br>
                If AIME &le; $1,174:<br>
                &nbsp;&nbsp;PIA = AIME &times; 90%<br><br>
                If $1,226 &lt; AIME &le; $7,391:<br>
                &nbsp;&nbsp;PIA = $1,226 &times; 90% + (AIME - $1,226) &times; 32%<br><br>
                If AIME &gt; $7,391:<br>
                &nbsp;&nbsp;PIA = $1,226 &times; 90% + ($7,391 - $1,226) &times; 32% + (AIME - $7,391) &times; 15%
            </div>
            <p>2025 SSA bend points: <strong>$1,226</strong> and <strong>$7,391</strong>. Used when user hasn't set an explicit SS benefit.</p>

            <h4>Claiming Age Adjustment</h4>
            <div class="formula">
                Early claiming (before ${glossaryTerm('FRA', 'fra')} 67):<br>
                &nbsp;&nbsp;months_early = (67 - claim_age) &times; 12<br>
                &nbsp;&nbsp;if months &le; 36: reduction = months &times; 5/9 &times; 1%<br>
                &nbsp;&nbsp;if months &gt; 36: reduction += (months - 36) &times; 5/12 &times; 1%<br><br>
                Delayed credits (after FRA 67):<br>
                &nbsp;&nbsp;bonus = 8% per year delayed (max age 70)
            </div>
            <table>
                <thead><tr><th>Claiming Age</th><th>Approximate % of PIA</th></tr></thead>
                <tbody>
                    <tr><td>62</td><td>70%</td></tr>
                    <tr><td>64</td><td>80%</td></tr>
                    <tr><td>67 (FRA)</td><td>100%</td></tr>
                    <tr><td>70</td><td>124%</td></tr>
                </tbody>
            </table>

            <h4>SS Optimization</h4>
            <p>Tests 9 combinations of claiming ages (62/67/70 for each spouse). Selects the combination with the highest Net Present Value at a 3% discount rate over 30 years.</p>
        `
    },
    {
        id: 'roth-conversion',
        title: 'Roth Conversion Optimization',
        content: `
            <h4>Bracket Space Analysis</h4>
            <div class="formula">
                For each bracket below target max rate (default 24%):<br>
                &nbsp;&nbsp;space = bracket_ceiling - max(current_taxable_income, bracket_floor)
            </div>

            <h4>Conversion Opportunity Window</h4>
            <div class="formula">
                conversion_years = (age 73 - current_age) - years_to_retirement<br><br>
                top_of_12% = $96,950<br>
                top_of_22% = $206,700<br>
                standard_deduction = $30,000 + $3,200 (65+, both spouses) = $33,200<br><br>
                available_12% = max(0, $96,950 - $33,200 - retirement_income)<br>
                available_22% = $206,700 - $96,950 = $109,750
            </div>

            <h4>Effective Rate</h4>
            <div class="formula">
                ${glossaryTerm('Effective Rate', 'effective_rate')} = (conversion_tax + IRMAA_increase) / conversion_amount
            </div>
            <p>Optimal conversion fills the lowest brackets each year between retirement and RMD start (age 73).</p>
        `
    },
    {
        id: 'spending',
        title: 'Spending Models',
        content: `
            <p>Applied as a multiplier on non-housing expenses. Housing costs are always constant (in real terms).</p>

            <h4>1. Constant Real (Default)</h4>
            <div class="formula">multiplier = 1.0 for all years</div>
            <p>Expenses track inflation exactly.</p>

            <h4>2. Retirement Smile</h4>
            <div class="formula">
                Age &lt; 70: multiplier = 1.0<br>
                Age 70-79: multiplier = 1.0 - (age - 70) &times; 0.02<br>
                Age 80+: multiplier = 0.8 + (age - 80) &times; 0.02
            </div>
            <p>Models higher spending early in retirement (travel), lower in middle years, higher again late (healthcare).</p>

            <h4>3. Conservative Decline</h4>
            <div class="formula">
                Age &gt; 70: multiplier = max(0.6, 1.0 - (age - 70) &times; 0.01)
            </div>
            <p>1% reduction per year after 70, floor at 60%.</p>

            <h4>Expense Blending by Category (Partial Retirement)</h4>
            <table>
                <thead><tr><th>Category</th><th>Transition Weight</th><th>Meaning</th></tr></thead>
                <tbody>
                    <tr><td>Transportation</td><td>0.8</td><td>Commuting drops quickly</td></tr>
                    <tr><td>Food / Dining</td><td>0.5</td><td>Gradual shift</td></tr>
                    <tr><td>Travel</td><td>0.3</td><td>Increases mostly when both retire</td></tr>
                    <tr><td>Healthcare</td><td>0.5</td><td>Gradual shift</td></tr>
                    <tr><td>Utilities</td><td>0.2</td><td>House stays same size</td></tr>
                    <tr><td>All Others</td><td>0.5</td><td>Default blend</td></tr>
                </tbody>
            </table>
            <div class="formula">
                blended = current &times; (1 - weight) + future &times; weight
            </div>
        `
    },
    {
        id: 'home-sale',
        title: 'Home Sale / Real Estate',
        content: `
            <div class="formula">
                transaction_costs = sale_price &times; 6%<br>
                capital_gain = sale_price - purchase_price<br>
                exclusion = $500,000 (primary residence) or $0 (other)<br>
                taxable_gain = max(0, capital_gain - exclusion)<br>
                federal_ltcg_tax = LTCG_tax(taxable_gain, stacked on ordinary income)<br>
                state_gain_tax = taxable_gain &times; state_rate<br><br>
                net_proceeds = sale_price - mortgage - transaction_costs - federal_ltcg_tax - state_gain_tax<br>
                available_cash = net_proceeds - replacement_cost
            </div>

            <h4>Annual Property Costs</h4>
            <div class="formula">
                total = property_tax + insurance + maintenance + HOA
            </div>
            <p>All property costs are inflation-adjusted via the CPI multiplier.</p>
        `
    },
    {
        id: 'cashflow-ledger',
        title: 'Cashflow & Portfolio Ledger',
        content: `
            <h4>Monthly Cashflow Identity</h4>
            <div class="formula">
                net_cash_before_expenses = ordinary_income + non_taxable_income - taxes<br>
                shortfall = expenses - net_cash_before_expenses<br>
                shortfall_covered_by_withdrawals = withdrawals_after_tax + net_rmd + liquidation_proceeds
            </div>
            <p>Positive shortfall triggers tax-aware withdrawals in waterfall order. Excess cash is invested.</p>

            <h4>Portfolio Balance Update</h4>
            <div class="formula">
                ending_portfolio = cash + taxable + pretax + 457b + roth<br>
                taxable_next = (taxable - withdrawals - basis_reduction + inflows) &times; (1 + return &times; 0.85)<br>
                pretax_next = (pretax - withdrawals - rmd + contributions) &times; (1 + return)<br>
                roth_next = (roth - withdrawals + contributions) &times; (1 + return)
            </div>
            <p>Taxable growth applies a 15% drag only when returns are positive.</p>

            <h4>Detailed Cashflow Output Fields</h4>
            <table>
                <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
                <tbody>
                    <tr><td>income</td><td>Ordinary taxable income + non-taxable SS portion + withdrawals</td></tr>
                    <tr><td>expenses_excluding_tax</td><td>Living and housing expenses only (taxes excluded)</td></tr>
                    <tr><td>federal_tax</td><td>Federal ordinary-income tax from bracket stacking</td></tr>
                    <tr><td>state_tax</td><td>State ordinary tax + state tax on realized gains and home-sale gain</td></tr>
                    <tr><td>fica_tax</td><td>Payroll taxes on employment income only</td></tr>
                    <tr><td>ltcg_tax</td><td>Federal long-term capital gains tax on realized gains</td></tr>
                    <tr><td>withdrawals</td><td>Gross account withdrawals used to cover shortfall</td></tr>
                    <tr><td>liquidation_proceeds</td><td>Net proceeds from asset sales (for example, home sales)</td></tr>
                    <tr><td>portfolio_balance</td><td>Total end-of-month balance across all modeled accounts</td></tr>
                </tbody>
            </table>
        `
    },
    {
        id: 'life-expectancy',
        title: 'Projection Period',
        content: `
            <div class="formula">
                years = target_age - current_age<br>
                current_age = (today - birth_date) / 365.25
            </div>
            <p>Default target: <strong>90</strong> (configurable per profile via life_expectancy field). For couples, the longer of the two projection periods is used.</p>
            <p>A spouse is only included in the years calculation if they have actual profile data (birth date, name, or Social Security benefit).</p>
        `
    },
    {
        id: 'wealth-transfer',
        title: 'Wealth Transfer / Gifting',
        content: `
            <div class="formula">
                annual_gift_per_child = $19,000 &times; 2 (both spouses) = $38,000<br>
                total_annual_gifts = $38,000 &times; number_of_children<br>
                years = min(person1_years, person2_years)<br>
                lifetime_gifts = annual_gifts &times; years<br><br>
                percentage_transferred = lifetime_gifts / net_worth &times; 100
            </div>
            <p>Uses the 2025 annual gift tax exclusion of <strong>$19,000 per recipient per donor</strong>.</p>
        `
    }
];

export function renderFinancialDataTab(container) {
    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
            <h2 style="color: var(--text-primary); margin-bottom: 4px;">Financial Calculation Reference</h2>
            <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 14px;">
                Complete documentation of every formula, constant, and algorithm used in the simulation engine.
                All values are 2025 IRS figures. Brackets and limits are inflation-adjusted during projection.
            </p>
            <div id="financial-data-sections"></div>
        </div>
    `;

    const sectionsContainer = container.querySelector('#financial-data-sections');

    const style = document.createElement('style');
    style.textContent = `
        .fd-section {
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin-bottom: 8px;
            overflow: hidden;
        }
        .fd-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: var(--bg-secondary);
            cursor: pointer;
            user-select: none;
            transition: background 0.15s;
        }
        .fd-header:hover {
            background: var(--bg-tertiary, var(--bg-secondary));
            filter: brightness(1.1);
        }
        .fd-header h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--text-primary);
        }
        .fd-toggle {
            font-size: 12px;
            color: var(--text-secondary);
        }
        .fd-body {
            display: none;
            padding: 16px 20px;
            border-top: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 14px;
            line-height: 1.6;
        }
        .fd-body.open {
            display: block;
        }
        .fd-body h4 {
            margin: 16px 0 8px 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--accent-color);
        }
        .fd-body h4:first-child {
            margin-top: 0;
        }
        .fd-body p {
            margin: 6px 0;
        }
        .fd-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 12px 0;
            font-size: 13px;
        }
        .fd-body th, .fd-body td {
            padding: 6px 10px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        .fd-body th {
            font-weight: 600;
            color: var(--text-secondary);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .fd-body td {
            color: var(--text-primary);
        }
        .formula {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 12px 16px;
            margin: 8px 0 12px 0;
            font-family: 'Source Code Pro', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.8;
            color: var(--text-primary);
            overflow-x: auto;
        }
        .fd-glossary-term {
            background: none;
            border: none;
            color: inherit;
            font: inherit;
            font-weight: inherit;
            cursor: pointer;
            text-decoration: underline dotted;
            text-underline-offset: 2px;
            padding: 0;
        }
        .fd-expand-all {
            display: inline-block;
            padding: 6px 14px;
            margin-bottom: 16px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-secondary);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .fd-expand-all:hover {
            background: var(--bg-tertiary, var(--bg-secondary));
            color: var(--text-primary);
        }
    `;
    container.appendChild(style);

    // Expand/collapse all button
    const expandBtn = document.createElement('button');
    expandBtn.className = 'fd-expand-all';
    expandBtn.textContent = 'Expand All';
    let allExpanded = false;
    expandBtn.addEventListener('click', () => {
        allExpanded = !allExpanded;
        expandBtn.textContent = allExpanded ? 'Collapse All' : 'Expand All';
        sectionsContainer.querySelectorAll('.fd-body').forEach(body => {
            body.classList.toggle('open', allExpanded);
        });
        sectionsContainer.querySelectorAll('.fd-toggle').forEach(toggle => {
            toggle.textContent = allExpanded ? 'Hide' : 'Show';
        });
    });
    sectionsContainer.before(expandBtn);

    // Render sections
    SECTIONS.forEach(section => {
        const el = document.createElement('div');
        el.className = 'fd-section';
        el.innerHTML = `
            <div class="fd-header">
                <h3>${section.title}</h3>
                <span class="fd-toggle">Show</span>
            </div>
            <div class="fd-body">${section.content}</div>
        `;

        const header = el.querySelector('.fd-header');
        const body = el.querySelector('.fd-body');
        const toggle = el.querySelector('.fd-toggle');

        header.addEventListener('click', () => {
            const isOpen = body.classList.toggle('open');
            toggle.textContent = isOpen ? 'Hide' : 'Show';
        });

        sectionsContainer.appendChild(el);
    });

    // Wire glossary handlers after all section HTML has been mounted.
    wireGlossaryTermClicks(container);
}
