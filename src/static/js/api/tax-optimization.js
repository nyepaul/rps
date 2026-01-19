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
    async analyzeSocialSecurity(profileName, lifeExpectancy = 90, filingStatus = null) {
        const payload = {
            profile_name: profileName,
            life_expectancy: lifeExpectancy
        };
        if (filingStatus) payload.filing_status = filingStatus;
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
    async projectRMD(profileName, growthRate = 0.05, years = 20) {
        return apiClient.post('/api/tax-optimization/rmd-projection', {
            profile_name: profileName,
            growth_rate: growthRate,
            years: years
        });
    }
};
