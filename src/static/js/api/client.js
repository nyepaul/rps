/**
 * API Client - Fetch wrapper with authentication and error handling
 */

import { API_URL } from '../config.js';
import { showSpinner, hideSpinner } from '../utils/dom.js';

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
    async function request(url, options = {}) {
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers,
            },
            credentials: 'include', // Include cookies for session
        };

        // Option to disable automatic redirect on 401 (critical for login page)
        const autoRedirect = options.autoRedirect !== false;

        // Add CSRF token for non-GET requests
        if (options.method && options.method !== 'GET') {
            const csrfToken = getCSRFToken();
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }

        // Setup 750ms loading spinner delay
        let spinnerTimer = setTimeout(() => {
            showSpinner('Loading...');
        }, 750);

        try {
            const response = await fetch(`${this.baseURL}${url}`, config);

            // Handle authentication errors
            if (response.status === 401 && autoRedirect) {
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
        } finally {
            // Clear timer and hide spinner
            clearTimeout(spinnerTimer);
            hideSpinner();
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
        console.log('PUT request:', url, 'method: PUT');
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

    /**
     * Specialized request for streaming progress updates
     */
    async streamRequest(url, data, onProgress) {
        const config = {
            method: 'POST',
            headers: {
                ...this.defaultHeaders,
            },
            body: JSON.stringify(data),
            credentials: 'include',
        };

        const csrfToken = getCSRFToken();
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }

        try {
            const response = await fetch(`${this.baseURL}${url}`, config);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(errorData.error || `HTTP ${response.status}`, response.status, errorData);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        // Check for error in the data object itself
                        if (data.error) {
                            throw new APIError(data.error, response.status, data);
                        }
                        
                        if (data.progress !== undefined || data.status === 'processing') {
                            if (onProgress) onProgress(data);
                        } else {
                            result = data; // Final result
                        }
                    } catch (e) {
                        if (e instanceof APIError) throw e;
                        console.warn('Failed to parse stream line:', line, e);
                    }
                }
            }
            
            if (!result && response.ok) {
                // If we finished but never got a final result object, the backend may have failed silently
                console.warn('Stream finished without a final result object');
                throw new APIError('Stream ended without returning data. The request may have failed.', 0, {});
            }

            return result;
        } catch (error) {
            throw error;
        }
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
