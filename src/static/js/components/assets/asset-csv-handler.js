/**
 * CSV Import/Export handlers
 */

import { assetsAPI } from "../../api/assets.js";
import { ASSET_CONFIG } from "../../utils/csv-parser.js";
import { renderCSVImportModal } from '../shared/csv-import-modal.js';
import { renderImportPreviewModal } from '../shared/import-preview-modal.js';
import { showError, showSuccess } from '../../utils/dom.js';

/**
 * Export assets to CSV
 */
export async function exportAssetsCSV(profileName) {
    try {
        const blob = await assetsAPI.exportCSV(profileName);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${profileName.replace(/ /g, "_")}_assets_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        return true;
    } catch (error) {
        console.error("CSV export error:", error);
        throw error;
    }
}

/**
 * Import assets from CSV
 */
export async function importAssetsCSV(profileName, onSuccess) {
    renderCSVImportModal('asset', ASSET_CONFIG, (parsedItems, filename) => {
        renderImportPreviewModal(parsedItems, 'asset', (confirmedItems) => {
            const newAssets = convertToAssetFormat(confirmedItems);
            const categorizedAssets = categorizeAssets(newAssets);
            
            // For assets, we rely on the caller (assets-tab.js) to perform the save
            // onSuccess handles the merging and saving
            if (onSuccess) onSuccess(categorizedAssets, true); // true = merge mode
            showSuccess(`Successfully imported ${confirmedItems.length} assets`);
        }, filename);
    });
}

/**
 * Convert parsed CSV items to asset objects
 */
function convertToAssetFormat(items) {
    return items.map(item => ({
        name: item.name,
        type: item.type?.toLowerCase() || 'other',
        value: parseFloat(item.value || item.amount) || 0,
        institution: item.institution || '',
        account_number: item.account_number || '',
        description: `Imported from CSV`
    }));
}

/**
 * Group assets by category
 */
function categorizeAssets(assets) {
    // Map of type to category
    const typeMap = {
        '401k': 'retirement_accounts',
        'roth_401k': 'retirement_accounts',
        'traditional_ira': 'retirement_accounts',
        'roth_ira': 'retirement_accounts',
        'sep_ira': 'retirement_accounts',
        'simple_ira': 'retirement_accounts',
        '403b': 'retirement_accounts',
        '457': 'retirement_accounts',
        'brokerage': 'taxable_accounts',
        'savings': 'taxable_accounts',
        'checking': 'taxable_accounts',
        'cd': 'taxable_accounts',
        'cash': 'taxable_accounts',
        'money_market': 'taxable_accounts',
        'primary_residence': 'real_estate',
        'rental_property': 'real_estate',
        'vacation_home': 'real_estate',
        'land': 'real_estate',
        'commercial': 'real_estate',
        'pension': 'pensions_annuities',
        'annuity': 'pensions_annuities',
        'mortgage': 'liabilities',
        'student_loan': 'liabilities',
        'credit_card': 'liabilities',
        'auto_loan': 'liabilities',
        'personal_loan': 'liabilities',
        'other_debt': 'liabilities'
    };

    const categorized = {
        retirement_accounts: [],
        taxable_accounts: [],
        real_estate: [],
        pensions_annuities: [],
        other_assets: [],
        liabilities: []
    };

    assets.forEach(asset => {
        const category = typeMap[asset.type] || 'other_assets';
        if (categorized[category]) {
            categorized[category].push(asset);
        } else {
            categorized.other_assets.push(asset);
        }
    });

    return categorized;
}
