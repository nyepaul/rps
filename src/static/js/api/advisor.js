/**
 * AI Advisor API client
 */

import { apiClient } from './client.js';

export const advisorAPI = {
    /**
     * Send chat message to AI advisor
     */
    async chat(profileName, message, conversationId = null, model = null) {
        return apiClient.post('/api/advisor/chat', {
            profile_name: profileName,
            message,
            conversation_id: conversationId,
            ollama_model: model
        });
    },

    /**
     * Get conversation history
     */
    async getHistory(profileName) {
        return apiClient.get(`/api/advisor/history?profile_name=${encodeURIComponent(profileName)}`);
    },

    /**
     * Clear conversation history
     */
    async clearHistory(conversationId) {
        return apiClient.delete(`/api/advisor/conversation/${conversationId}`);
    }
};
