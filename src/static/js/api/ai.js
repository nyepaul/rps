/**
 * AI Services API client
 * General purpose AI endpoints (extraction, enhancement, analysis)
 */

import { apiClient } from './client.js';

export const aiAPI = {
    /**
     * Enhance CSV import data with AI
     * Detects duplicates and suggests categories
     * 
     * @param {string} profileName - Name of the profile
     * @param {string} type - 'income', 'expense', or 'asset'
     * @param {Array} items - List of items to enhance
     * @param {Object} extraData - Additional context (e.g. { period: 'current' })
     */
    async enhanceCSV(profileName, type, items, extraData = {}) {
        return apiClient.post('/api/enhance-csv-import', {
            profile_name: profileName,
            type: type,
            items: items,
            extra_data: extraData
        });
    },

    /**
     * Extract data from image/PDF
     */
    async extractFromDocument(profileName, type, file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('profile_name', profileName);
        formData.append('type', type);

        // Note: client.js handles FormData automatically if body is FormData
        // But we need to make sure headers are handled correctly (no Content-Type for multipart)
        return apiClient.post('/api/ai/extract', formData);
    }
};
