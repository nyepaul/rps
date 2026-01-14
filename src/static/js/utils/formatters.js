/**
 * Utility functions for formatting data
 */

/**
 * Format number as currency
 */
export function formatCurrency(value, decimals = 0) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/**
 * Format number as percentage
 */
export function formatPercent(value, decimals = 1) {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/**
 * Format date
 */
export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompact(value) {
    if (value >= 1000000000) {
        return `$${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value, 0);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(str) {
    if (typeof str === 'number') return str;
    return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
}
