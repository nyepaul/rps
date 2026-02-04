/**
 * Utility to load HTML templates dynamically.
 */

export async function loadTemplate(templatePath) {
    try {
        const response = await fetch(templatePath);
        if (!response.ok) {
            throw new Error(`Failed to load template from ${templatePath}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error loading template:', error);
        return ''; // Return empty string to prevent further errors
    }
}