/**
 * Tax Optimization API client
 */

import { apiClient } from './client.js';

export const taxOptimizationAPI = {
    /**
     * Get comprehensive tax analysis
     */
    async analyzeComprehensive(profileName, filingStatus = 'mfj', state = 'CA') {
        return apiClient.post('/api/tax-optimization/analyze', {
            profile_name: profileName,
            filing_status: filingStatus,
            state: state
        });
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
     */
    async analyzeRothConversion(profileName, conversionAmounts = null, filingStatus = 'mfj', state = 'CA') {
        return apiClient.post('/api/tax-optimization/roth-conversion', {
            profile_name: profileName,
            conversion_amounts: conversionAmounts,
            filing_status: filingStatus,
            state: state
        });
    },

    /**
     * Analyze Social Security claiming strategies
     */
    async analyzeSocialSecurity(profileName, lifeExpectancy = 90, filingStatus = 'mfj') {
        return apiClient.post('/api/tax-optimization/social-security-timing', {
            profile_name: profileName,
            life_expectancy: lifeExpectancy,
            filing_status: filingStatus
        });
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
