/**
 * Analysis API client
 */

import { apiClient } from './client.js';
import { API_ENDPOINTS } from '../config.js';

export const analysisAPI = {
    /**
     * Run Monte Carlo analysis
     */
    async runAnalysis(profileName, simulations = 10000, marketProfile = null, spendingModel = 'constant_real', marketPeriods = null) {
        const payload = {
            profile_name: profileName,
            simulations,
            spending_model: spendingModel
        };

        // Add market profile if provided
        if (marketProfile) {
            payload.market_profile = marketProfile;
        }

        // Add market periods if provided
        if (marketPeriods) {
            payload.market_periods = marketPeriods;
        }

        return apiClient.post(API_ENDPOINTS.ANALYSIS_RUN, payload);
    },

    /**
     * Get Social Security optimization
     */
    async optimizeSocialSecurity(profileName) {
        return apiClient.post(API_ENDPOINTS.ANALYSIS_SS, {
            profile_name: profileName
        });
    },

    /**
     * Analyze Roth conversion
     */
    async analyzeRothConversion(profileName, conversionAmount, conversionAge) {
        return apiClient.post(API_ENDPOINTS.ANALYSIS_ROTH, {
            profile_name: profileName,
            conversion_amount: conversionAmount,
            conversion_age: conversionAge
        });
    },

    /**
     * Analyze rebalancing
     */
    async analyzeRebalancing(profileName, targetAllocation) {
        return apiClient.post(API_ENDPOINTS.ANALYSIS_REBALANCE, {
            profile_name: profileName,
            target_allocation: targetAllocation
        });
    }
};
