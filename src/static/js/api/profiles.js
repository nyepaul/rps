/**
 * Profile API service
 */

import { apiClient } from './client.js';
import { API_ENDPOINTS } from '../config.js';

export const profilesAPI = {
    /**
     * Get all profiles for current user
     */
    async list() {
        return await apiClient.get(API_ENDPOINTS.PROFILES_LIST);
    },

    /**
     * Get specific profile by name
     */
    async get(name) {
        return await apiClient.get(API_ENDPOINTS.PROFILE_GET(name));
    },

    /**
     * Create new profile
     */
    async create(profileData) {
        return await apiClient.post(API_ENDPOINTS.PROFILE_CREATE, profileData);
    },

    /**
     * Update existing profile
     */
    async update(name, profileData) {
        return await apiClient.put(API_ENDPOINTS.PROFILE_UPDATE(name), profileData);
    },

    /**
     * Delete profile
     */
    async delete(name) {
        return await apiClient.delete(API_ENDPOINTS.PROFILE_DELETE(name));
    },

    /**
     * Clone profile
     */
    async clone(name, newName) {
        return await apiClient.post(`/api/profile/${encodeURIComponent(name)}/clone`, { new_name: newName });
    },
};
