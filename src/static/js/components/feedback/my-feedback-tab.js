/**
 * My Feedback Tab - Wrapper for feedback tracking interface
 */

import { initMyFeedback } from './my-feedback.js';

/**
 * Render My Feedback tab
 */
export async function renderMyFeedbackTab(container) {
    container.innerHTML = `
        <div id="my-feedback-container"></div>
    `;

    // Initialize the my feedback component
    await initMyFeedback();
}
