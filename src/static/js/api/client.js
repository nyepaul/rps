/**
 * API Client - Fetch wrapper with authentication and error handling
 */

import { API_URL } from '../config.js';

/**
 * Get CSRF token from meta tag or cookie
 */
function getCSRFToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
        return meta.getAttribute('content');
    }
    return null;
}

/**
 * HTTP Client class
 */
class APIClient {
    constructor(baseURL = API_URL) {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Make HTTP request
     */
    async request(url, options = {}) {
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers,
            },
            credentials: 'include', // Include cookies for session
        };

        // Add CSRF token for non-GET requests
        if (options.method && options.method !== 'GET') {
            const csrfToken = getCSRFToken();
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }

        try {
            const response = await fetch(`${this.baseURL}${url}`, config);

            // Handle authentication errors
            if (response.status === 401) {
                // Redirect to login
                window.location.href = '/login';
                throw new Error('Unauthorized');
            }

            // Parse JSON response
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new APIError(
                    data.error || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    data
                );
            }

            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.message || 'Network error', 0, {});
        }
    }

    /**
     * GET request
     */
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * PUT request
     */
    async put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * PATCH request
     */
    async patch(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for testing/extension
export default APIClient;
