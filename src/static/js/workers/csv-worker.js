/**
 * CSV Parsing Web Worker
 * Handles large CSV parsing off the main thread to prevent UI freezing.
 */

// Since workers can't easily import modules without a bundler in some environments,
// we will duplicate the core parsing logic here or import it if supported.
// Modern browsers support module workers (new Worker('...', {type: 'module'})).
// Assuming we can use module workers for cleaner code re-use.

import { parseCSV } from '../utils/csv-parser.js';

self.onmessage = function(e) {
    const { text, config } = e.data;

    if (!text || !config) {
        self.postMessage({ error: 'Missing text or config' });
        return;
    }

    try {
        // Parse the CSV data
        const result = parseCSV(text, config);
        
        // Send back the result
        self.postMessage({ success: true, result });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
