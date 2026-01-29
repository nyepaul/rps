/**
 * Transactions API Client
 * Handles CSV transaction import and reconciliation
 */

import { apiClient } from './client.js';

/**
 * Import transactions from CSV file
 * Streams progress updates via NDJSON
 * @param {string} profileName - Profile name
 * @param {File} file - CSV file to upload
 * @param {function} onProgress - Progress callback (status, progress, message, data)
 * @returns {Promise<object>} - Final analysis result
 */
export async function importTransactions(profileName, file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/profile/${encodeURIComponent(profileName)}/transactions/import`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Import failed: ${response.statusText}`);
    }

    // Read NDJSON stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                const data = JSON.parse(line);

                if (data.status === 'error') {
                    throw new Error(data.error || 'Import failed');
                }

                if (onProgress) {
                    onProgress(data.status, data.progress, data.message, data.data);
                }

                if (data.status === 'complete') {
                    finalResult = data.data;
                }
            } catch (e) {
                console.error('Failed to parse NDJSON line:', line, e);
                throw new Error('Failed to parse server response');
            }
        }
    }

    if (!finalResult) {
        throw new Error('No result received from server');
    }

    return finalResult;
}

/**
 * Apply reconciliation actions
 * @param {string} profileName - Profile name
 * @param {Array} actions - Array of reconciliation actions
 * @returns {Promise<object>} - Result summary
 */
export async function reconcileTransactions(profileName, actions) {
    const response = await apiClient.post(
        `/api/profile/${encodeURIComponent(profileName)}/transactions/reconcile`,
        { actions }
    );

    return response;
}

/**
 * Helper: Create action object for merging income
 * @param {number} streamIndex - Index in income_streams array
 * @param {object} updates - Updated values
 * @returns {object} - Action object
 */
export function createMergeAction(streamIndex, updates) {
    return {
        type: 'merge',
        stream_index: streamIndex,
        updates
    };
}

/**
 * Helper: Create action object for adding new income
 * @param {object} stream - New income stream
 * @returns {object} - Action object
 */
export function createAddNewAction(stream) {
    return {
        type: 'add_new',
        stream
    };
}

/**
 * Helper: Create action object for ignoring pattern
 * @param {object} stream - Stream to ignore
 * @returns {object} - Action object
 */
export function createIgnoreAction(stream) {
    return {
        type: 'ignore',
        stream
    };
}

/**
 * Helper: Create action object for adding expense
 * @param {string} category - Expense category
 * @param {object} expense - Expense data
 * @returns {object} - Action object
 */
export function createAddExpenseAction(category, expense) {
    return {
        type: 'add_expense',
        category,
        expense
    };
}
