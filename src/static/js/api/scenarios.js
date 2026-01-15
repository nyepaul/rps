/**
 * Scenarios API client
 */

import { apiClient } from './client.js';
import { API_ENDPOINTS } from '../config.js';

export const scenariosAPI = {
    /**
     * List all scenarios for the current user
     */
    async list() {
        return apiClient.get(API_ENDPOINTS.SCENARIOS_LIST);
    },

    /**
     * Get a specific scenario by ID
     */
    async get(id) {
        return apiClient.get(API_ENDPOINTS.SCENARIO_GET(id));
    },

    /**
     * Create a new scenario
     */
    async create(name, profileName, parameters, results) {
        return apiClient.post(API_ENDPOINTS.SCENARIO_CREATE, {
            name,
            profile_name: profileName,
            parameters,
            results
        });
    },

    /**
     * Update an existing scenario
     */
    async update(id, updates) {
        return apiClient.put(API_ENDPOINTS.SCENARIO_UPDATE(id), updates);
    },

    /**
     * Delete a scenario
     */
    async delete(id) {
        return apiClient.delete(API_ENDPOINTS.SCENARIO_DELETE(id));
    }
};