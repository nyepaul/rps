/**
 * Tax Optimization API client
 */

import { apiClient } from './client.js';

export const taxOptimizationAPI = {
    /**
     * Get comprehensive tax analysis
     * @param {string} profileName - Profile to analyze
     * @param {string|null} filingStatus - Filing status (null = use profile default)
     * @param {string|null} state - State (null = use profile's address/tax_settings)
     */
    async analyzeComprehensive(profileName, filingStatus = null, state = null) {
        const payload = { profile_name: profileName };
        // Only include optional params if explicitly provided
        // This lets the backend use profile settings as defaults
        if (filingStatus) payload.filing_status = filingStatus;
        if (state) payload.state = state;
        return apiClient.post('/api/tax-optimization/analyze', payload);
    },

    /**
     * Get tax snapshot
     */
    async getSnapshot(profileName) {
        return apiClient.post('/api/tax-optimization/snapshot', {
            profile_name: profileName
        });
    },

    /**
     * Analyze Roth conversion opportunities
     * @param {string} profileName - Profile to analyze
     * @param {number[]|null} conversionAmounts - Specific amounts to analyze
     * @param {string|null} filingStatus - Filing status (null = use profile default)
     * @param {string|null} state - State (null = use profile's address/tax_settings)
     */
    async analyzeRothConversion(profileName, conversionAmounts = null, filingStatus = null, state = null) {
        const payload = { profile_name: profileName };
        if (conversionAmounts) payload.conversion_amounts = conversionAmounts;
        if (filingStatus) payload.filing_status = filingStatus;
        if (state) payload.state = state;
        return apiClient.post('/api/tax-optimization/roth-conversion', payload);
    },

    /**
     * Analyze Social Security claiming strategies
     * @param {string} profileName - Profile to analyze
     * @param {number} lifeExpectancy - Expected lifespan
     * @param {string|null} filingStatus - Filing status (null = use profile default)
     */
    async analyzeSocialSecurity(profileName, lifeExpectancy = 90, filingStatus = null, options = {}) {
        const payload = {
            profile_name: profileName,
            life_expectancy: lifeExpectancy
        };
        if (filingStatus) payload.filing_status = filingStatus;
        if (options.annualEarnedIncome !== undefined && options.annualEarnedIncome !== null) {
            payload.annual_earned_income = options.annualEarnedIncome;
        }
        if (options.applyWep !== undefined) {
            payload.apply_wep = Boolean(options.applyWep);
        }
        if (options.applyGpo !== undefined) {
            payload.apply_gpo = Boolean(options.applyGpo);
        }
        if (options.noncoveredPensionAnnual !== undefined && options.noncoveredPensionAnnual !== null) {
            payload.noncovered_pension_annual = options.noncoveredPensionAnnual;
        }
        return apiClient.post('/api/tax-optimization/social-security-timing', payload);
    },

    /**
     * Compare state tax burden
     */
    async compareStates(profileName) {
        return apiClient.post('/api/tax-optimization/state-comparison', {
            profile_name: profileName
        });
    },

    /**
     * Project Required Minimum Distributions
     */
    async projectRMD(profileName, growthRate = 0.05, years = 20, annualCharitableGiving = null) {
        const payload = {
            profile_name: profileName,
            growth_rate: growthRate,
            years: years
        };
        if (annualCharitableGiving !== null && annualCharitableGiving !== undefined) {
            payload.annual_charitable_giving = annualCharitableGiving;
        }
        return apiClient.post('/api/tax-optimization/rmd-projection', payload);
    },

    /**
     * Project healthcare and Medicare costs.
     * @param {string} profileName - Profile to analyze
     * @param {number} years - Projection years
     */
    async analyzeHealthcarePlanning(profileName, years = 20, options = {}) {
        const payload = {
            profile_name: profileName,
            years,
        };
        if (options.medicalInflation !== undefined && options.medicalInflation !== null) {
            payload.medical_inflation = options.medicalInflation;
        }
        if (options.incomeGrowth !== undefined && options.incomeGrowth !== null) {
            payload.income_growth = options.incomeGrowth;
        }
        if (options.estimatedMagi !== undefined && options.estimatedMagi !== null && options.estimatedMagi !== '') {
            payload.estimated_magi = options.estimatedMagi;
        }
        if (options.annualOutOfPocket !== undefined && options.annualOutOfPocket !== null && options.annualOutOfPocket !== '') {
            payload.annual_out_of_pocket = options.annualOutOfPocket;
        }
        if (options.initialHsaBalance !== undefined && options.initialHsaBalance !== null && options.initialHsaBalance !== '') {
            payload.initial_hsa_balance = options.initialHsaBalance;
        }
        if (options.annualHsaContribution !== undefined && options.annualHsaContribution !== null && options.annualHsaContribution !== '') {
            payload.annual_hsa_contribution = options.annualHsaContribution;
        }
        if (options.hsaGrowth !== undefined && options.hsaGrowth !== null) {
            payload.hsa_growth = options.hsaGrowth;
        }
        return apiClient.post('/api/analysis/healthcare-planning', payload);
    }
};
