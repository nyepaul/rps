/**
 * Assets API client
 */

export const assetsAPI = {
    /**
     * Export assets to CSV
     */
    async exportCSV(profileName) {
        const response = await fetch(`/api/profile/${encodeURIComponent(profileName)}/assets/export`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to export assets');
        }

        return response.blob();
    },

    /**
     * Import assets from CSV
     */
    async importCSV(profileName, file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/profile/${encodeURIComponent(profileName)}/assets/import`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to import assets');
        }

        return response.json();
    }
};
