/**
 * CSV Parser Utility
 * Unified CSV parsing for Income, Budget (Expenses), and Assets
 * Handles various delimiters, encodings, and column name variations
 */

/**
 * Parse CSV text into structured data
 * @param {string} text - Raw CSV text
 * @param {Object} config - Configuration object for the data type
 * @returns {Object} - Parsed result: { items: [], errors: [], warnings: [] }
 */
export function parseCSV(text, config) {
    const result = {
        items: [],
        errors: [],
        warnings: []
    };

    try {
        // Detect and handle different line endings
        const lines = text.split(/\r?\n/).filter(l => l.trim());

        if (lines.length === 0) {
            result.errors.push('CSV file is empty');
            return result;
        }

        if (lines.length < 2) {
            result.errors.push('CSV must have headers and at least one data row');
            return result;
        }

        // Detect delimiter
        const delimiter = detectDelimiter(lines[0]);

        // Parse headers
        const headers = parseCSVLine(lines[0], delimiter)
            .map(h => normalizeColumnName(h));

        // Validate required columns exist
        const missingRequired = config.requiredColumns?.filter(
            col => !headers.some(h => config.columnMappings[col]?.includes(h))
        ) || [];

        if (missingRequired.length > 0) {
            result.errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
            return result;
        }

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const lineNum = i + 1;
            const values = parseCSVLine(lines[i], delimiter);

            // Skip empty rows
            if (values.every(v => !v.trim())) {
                continue;
            }

            // Map values to headers
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });

            // Transform row to expected format
            try {
                const item = config.transformRow(row, config);

                // Validate item
                const validation = config.validateItem ? config.validateItem(item) : { valid: true };

                if (validation.valid) {
                    if (validation.warnings) {
                        result.warnings.push(`Line ${lineNum}: ${validation.warnings}`);
                    }
                    result.items.push(item);
                } else {
                    result.warnings.push(`Line ${lineNum}: ${validation.message}`);
                    // Still add item even with warnings (non-blocking validation)
                    result.items.push(item);
                }
            } catch (error) {
                result.warnings.push(`Line ${lineNum}: ${error.message}`);
            }
        }

        if (result.items.length === 0 && result.warnings.length === 0) {
            result.errors.push('No valid data rows found in CSV');
        }

    } catch (error) {
        result.errors.push(`Parse error: ${error.message}`);
    }

    return result;
}

/**
 * Detect delimiter from CSV header line
 * @param {string} line - First line of CSV
 * @returns {string} - Detected delimiter (comma, tab, semicolon, or pipe)
 */
export function detectDelimiter(line) {
    const delimiters = [',', '\t', ';', '|'];
    const counts = delimiters.map(d => ({
        delimiter: d,
        count: (line.match(new RegExp(`\\${d}`, 'g')) || []).length
    }));

    // Return delimiter with highest count, default to comma
    counts.sort((a, b) => b.count - a.count);
    return counts[0].count > 0 ? counts[0].delimiter : ',';
}

/**
 * Normalize column name to standard format
 * @param {string} name - Raw column name from CSV
 * @returns {string} - Normalized name (lowercase, underscores)
 */
export function normalizeColumnName(name) {
    return name
        .replace(/"/g, '')  // Remove quotes
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')  // Spaces to underscores
        .replace(/[^a-z0-9_]/g, '');  // Remove special chars
}

/**
 * Parse a single CSV line handling quoted values
 * @param {string} line - CSV line
 * @param {string} delimiter - Delimiter character
 * @returns {Array<string>} - Array of cell values
 */
export function parseCSVLine(line, delimiter = ',') {
    const cells = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                i++;
                continue;
            }
        }

        if (char === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = '';
            i++;
            continue;
        }

        current += char;
        i++;
    }

    // Add final cell
    cells.push(current.trim());

    // Clean up cells - remove surrounding quotes
    return cells.map(cell => {
        if (cell.startsWith('"') && cell.endsWith('"')) {
            return cell.slice(1, -1).trim();
        }
        return cell;
    });
}

/**
 * Get column value from row using multiple possible column names
 * @param {Object} row - Parsed row object
 * @param {Array<string>} possibleNames - Array of possible column names
 * @returns {string} - Value from first matching column, or empty string
 */
export function getColumnValue(row, possibleNames) {
    for (const name of possibleNames) {
        const normalized = normalizeColumnName(name);
        if (row[normalized] !== undefined && row[normalized] !== '') {
            return row[normalized];
        }
    }
    return '';
}

// ============================================================================
// Configuration Objects for Each Data Type
// ============================================================================

/**
 * Income stream CSV configuration
 */
export const INCOME_CONFIG = {
    type: 'income',
    requiredColumns: ['name', 'amount'],
    columnMappings: {
        name: ['name', 'source', 'income_name', 'income_source'],
        amount: ['amount', 'monthly', 'monthly_amount', 'value'],
        start_date: ['start_date', 'start', 'begin_date', 'startdate'],
        end_date: ['end_date', 'end', 'finish_date', 'enddate'],
        description: ['description', 'notes', 'note', 'details'],
        owner: ['owner', 'person', 'who']
    },
    transformRow: (row, config) => {
        return {
            name: getColumnValue(row, config.columnMappings.name),
            amount: parseFloat(getColumnValue(row, config.columnMappings.amount)) || 0,
            start_date: getColumnValue(row, config.columnMappings.start_date),
            end_date: getColumnValue(row, config.columnMappings.end_date),
            description: getColumnValue(row, config.columnMappings.description),
            owner: getColumnValue(row, config.columnMappings.owner) || 'primary'
        };
    },
    validateItem: (item) => {
        const warnings = [];

        if (!item.name) {
            return { valid: false, message: 'Name is required' };
        }

        if (item.amount < 0) {
            warnings.push('Amount is negative');
        }

        if (item.amount === 0) {
            warnings.push('Amount is zero');
        }

        return {
            valid: true,
            warnings: warnings.length > 0 ? warnings.join('; ') : null
        };
    }
};

/**
 * Expense (Budget) CSV configuration
 */
export const EXPENSE_CONFIG = {
    type: 'expense',
    requiredColumns: ['name', 'amount'],
    columnMappings: {
        name: ['name', 'expense', 'description', 'item'],
        amount: ['amount', 'monthly', 'cost', 'value'],
        category: ['category', 'type', 'group'],
        frequency: ['frequency', 'period', 'interval']
    },
    validCategories: ['housing', 'transportation', 'food', 'healthcare', 'utilities', 'insurance', 'personal', 'entertainment', 'other'],
    transformRow: (row, config) => {
        let category = (getColumnValue(row, config.columnMappings.category) || 'other').toLowerCase();

        // Map category to valid categories
        if (!config.validCategories.includes(category)) {
            category = 'other';
        }

        let frequency = getColumnValue(row, config.columnMappings.frequency) || 'monthly';
        frequency = frequency.toLowerCase();

        return {
            name: getColumnValue(row, config.columnMappings.name),
            amount: parseFloat(getColumnValue(row, config.columnMappings.amount)) || 0,
            category: category,
            frequency: frequency,
            inflation_adjusted: true,
            ongoing: true,
            start_date: null,
            end_date: null
        };
    },
    validateItem: (item) => {
        const warnings = [];

        if (!item.name) {
            return { valid: false, message: 'Name is required' };
        }

        if (item.amount < 0) {
            warnings.push('Amount is negative');
        }

        if (item.amount === 0) {
            warnings.push('Amount is zero');
        }

        return {
            valid: true,
            warnings: warnings.length > 0 ? warnings.join('; ') : null
        };
    }
};

/**
 * Asset CSV configuration
 */
export const ASSET_CONFIG = {
    type: 'asset',
    requiredColumns: ['name'],
    columnMappings: {
        name: ['name', 'asset_name', 'account_name'],
        type: ['type', 'asset_type', 'account_type', 'category'],
        institution: ['institution', 'bank', 'financial_institution', 'provider'],
        account_number: ['account_number', 'account', 'acct_number', 'account_no'],
        balance: ['balance', 'value', 'current_value', 'amount'],
        owner: ['owner', 'person', 'who']
    },
    validTypes: ['401k', 'traditional_ira', 'roth_ira', 'brokerage', 'savings', 'checking', 'real_estate', 'other'],
    transformRow: (row, config) => {
        let assetType = (getColumnValue(row, config.columnMappings.type) || 'other').toLowerCase();

        // Normalize type names
        assetType = assetType.replace(/\s+/g, '_');

        // Map common variations
        const typeMapping = {
            '401(k)': '401k',
            '401k': '401k',
            'traditional': 'traditional_ira',
            'trad_ira': 'traditional_ira',
            'roth': 'roth_ira',
            'brokerage': 'brokerage',
            'taxable': 'brokerage',
            'savings': 'savings',
            'checking': 'checking',
            'bank': 'checking',
            'property': 'real_estate',
            'real_estate': 'real_estate',
            'home': 'real_estate'
        };

        assetType = typeMapping[assetType] || 'other';

        if (!config.validTypes.includes(assetType)) {
            assetType = 'other';
        }

        return {
            name: getColumnValue(row, config.columnMappings.name),
            type: assetType,
            institution: getColumnValue(row, config.columnMappings.institution),
            account_number: getColumnValue(row, config.columnMappings.account_number),
            balance: parseFloat(getColumnValue(row, config.columnMappings.balance)) || 0,
            owner: getColumnValue(row, config.columnMappings.owner) || 'primary'
        };
    },
    validateItem: (item) => {
        const warnings = [];

        if (!item.name) {
            return { valid: false, message: 'Name is required' };
        }

        if (item.balance < 0) {
            warnings.push('Balance is negative (consider marking as liability)');
        }

        if (item.balance === 0) {
            warnings.push('Balance is zero');
        }

        return {
            valid: true,
            warnings: warnings.length > 0 ? warnings.join('; ') : null
        };
    }
};

/**
 * Validate CSV file before parsing
 * @param {File} file - File object
 * @returns {Object} - Validation result
 */
export function validateCSVFile(file) {
    const errors = [];

    if (!file) {
        errors.push('No file selected');
        return { valid: false, errors };
    }

    if (!file.name.endsWith('.csv')) {
        errors.push('File must be a CSV (.csv extension)');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        errors.push(`File too large (max ${maxSize / (1024 * 1024)}MB)`);
    }

    if (file.size === 0) {
        errors.push('File is empty');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
