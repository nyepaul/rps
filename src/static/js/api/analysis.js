/**
 * Analysis API client
 */

import { apiClient } from './client.js';
import { API_ENDPOINTS } from '../config.js';

export const analysisAPI = {
    /**
     * Run Monte Carlo analysis
     */
    async runAnalysis(profileName, simulations = 10000, marketProfile = null) {
        const payload = {
            profile_name: profileName,
            simulations
        };

        // Add market profile if provided
        if (marketProfile) {
            payload.market_profile = marketProfile;
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
    }
};
