/**
 * Action Items API client
 */

import { apiClient } from './client.js';
import { API_ENDPOINTS } from '../config.js';

export const actionItemsAPI = {
    /**
     * List all action items for current user
     */
    async list(profileName = null) {
        const params = profileName ? `?profile_name=${encodeURIComponent(profileName)}` : '';
        return apiClient.get(`${API_ENDPOINTS.ACTION_ITEMS_LIST}${params}`);
    },

    /**
     * Get action item by ID
     */
    async get(id) {
        return apiClient.get(API_ENDPOINTS.ACTION_ITEM_GET(id));
    },

    /**
     * Create new action item
     */
    async create(actionItemData) {
        return apiClient.post(API_ENDPOINTS.ACTION_ITEM_CREATE, actionItemData);
    },

    /**
     * Update action item
     */
    async update(id, actionItemData) {
        return apiClient.put(API_ENDPOINTS.ACTION_ITEM_UPDATE(id), actionItemData);
    },

    /**
     * Delete action item
     */
    async delete(id) {
        return apiClient.delete(API_ENDPOINTS.ACTION_ITEM_DELETE(id));
    },

    /**
     * Mark action item as complete
     */
    async markComplete(id) {
        return this.update(id, { status: 'completed' });
    },

    /**
     * Mark action item as incomplete
     */
    async markIncomplete(id) {
        return this.update(id, { status: 'pending' });
    }
};
