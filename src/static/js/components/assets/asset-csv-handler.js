/**
 * CSV Import/Export handlers
 */

import { assetsAPI } from "../../api/assets.js";
import { ASSET_CONFIG } from "../../utils/csv-parser.js";
import { showCSVImportModal } from "../shared/csv-import-modal.js";

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
    showCSVImportModal({
        title: "Import Assets from CSV",
        config: ASSET_CONFIG,
        profileName: profileName,
        onComplete: (updatedProfile) => {
            if (onSuccess) onSuccess(updatedProfile);
        },
    });
}
