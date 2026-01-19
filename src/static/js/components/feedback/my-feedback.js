/**
 * My Feedback - User feedback tracking interface
 * Allows users to view their feedback submissions and admin replies
 */

import { API_ENDPOINTS } from '/js/config.js';

/**
 * Initialize My Feedback view
 */
export async function initMyFeedback() {
    const container = document.getElementById('my-feedback-container');
    if (!container) {
        console.error('My feedback container not found');
        return;
    }

    container.innerHTML = `
        <div class="my-feedback-wrapper">
            <div class="my-feedback-header">
                <h2>My Feedback</h2>
                <p class="help-text">Track your feedback submissions and view admin responses</p>
            </div>

            <div class="filter-controls">
                <div class="filter-group">
                    <label for="filter-type">Type:</label>
                    <select id="filter-type" class="filter-select">
                        <option value="">All Types</option>
                        <option value="comment">Comment</option>
                        <option value="feature">Feature Request</option>
                        <option value="bug">Bug Report</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label for="filter-status">Status:</label>
                    <select id="filter-status" class="filter-select">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>

                <button id="refresh-feedback" class="btn-secondary">
                    <span>🔄</span> Refresh
                </button>
            </div>

            <div id="feedback-list" class="feedback-list"></div>

            <div id="feedback-thread-modal" class="modal" style="display: none;">
                <div class="modal-content feedback-thread-content">
                    <span class="close">&times;</span>
                    <div id="feedback-thread-body"></div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    document.getElementById('filter-type').addEventListener('change', loadMyFeedback);
    document.getElementById('filter-status').addEventListener('change', loadMyFeedback);
    document.getElementById('refresh-feedback').addEventListener('click', loadMyFeedback);

    // Modal close button
    const modal = document.getElementById('feedback-thread-modal');
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Load feedback
    await loadMyFeedback();
}

/**
 * Load user's feedback from API
 */
async function loadMyFeedback() {
    const listContainer = document.getElementById('feedback-list');
    listContainer.innerHTML = '<div class="loading">Loading your feedback...</div>';

    try {
        const typeFilter = document.getElementById('filter-type').value;
        const statusFilter = document.getElementById('filter-status').value;

        // Build query params
        const params = new URLSearchParams();
        if (typeFilter) params.append('type', typeFilter);
        if (statusFilter) params.append('status', statusFilter);
        params.append('limit', '50');

        const response = await fetch(`/api/feedback/my?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();

        if (!data.feedback || data.feedback.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>📝 No feedback found</p>
                    <p class="help-text">Submit feedback using the Feedback button in the header</p>
                </div>
            `;
            return;
        }

        renderFeedbackList(data.feedback);

    } catch (error) {
        console.error('Error loading feedback:', error);
        listContainer.innerHTML = `
            <div class="error-message">
                ⚠️ Failed to load feedback. Please try again.
            </div>
        `;
    }
}

/**
 * Render feedback list
 */
function renderFeedbackList(feedbackItems) {
    const listContainer = document.getElementById('feedback-list');

    const html = feedbackItems.map(item => {
        const hasReplies = item.last_reply_at !== null;
        const statusClass = getStatusClass(item.status);
        const typeIcon = getTypeIcon(item.type);
        const date = new Date(item.created_at).toLocaleDateString();

        return `
            <div class="feedback-item ${statusClass}" data-id="${item.id}">
                <div class="feedback-item-header">
                    <div class="feedback-type-badge">
                        ${typeIcon} ${item.type}
                    </div>
                    <div class="feedback-status-badge status-${item.status}">
                        ${item.status}
                    </div>
                    ${hasReplies ? '<span class="reply-indicator">💬 Has Reply</span>' : ''}
                </div>

                <div class="feedback-item-content">
                    <p>${truncateText(item.content, 200)}</p>
                </div>

                <div class="feedback-item-footer">
                    <span class="feedback-date">Submitted: ${date}</span>
                    ${item.last_reply_at ? `<span class="reply-date">Last reply: ${new Date(item.last_reply_at).toLocaleDateString()}</span>` : ''}
                    <button class="btn-link view-thread-btn" data-id="${item.id}">
                        View Details →
                    </button>
                </div>
            </div>
        `;
    }).join('');

    listContainer.innerHTML = html;

    // Add click handlers for view thread buttons
    document.querySelectorAll('.view-thread-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const feedbackId = e.target.getAttribute('data-id');
            await viewFeedbackThread(feedbackId);
        });
    });
}

/**
 * View full feedback thread with replies
 */
async function viewFeedbackThread(feedbackId) {
    const modal = document.getElementById('feedback-thread-modal');
    const body = document.getElementById('feedback-thread-body');

    body.innerHTML = '<div class="loading">Loading thread...</div>';
    modal.style.display = 'block';

    try {
        const response = await fetch(`/api/feedback/my/${feedbackId}/thread`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const thread = await response.json();

        body.innerHTML = renderFeedbackThread(thread);

    } catch (error) {
        console.error('Error loading thread:', error);
        body.innerHTML = '<div class="error-message">Failed to load thread</div>';
    }
}

/**
 * Render full feedback thread
 */
function renderFeedbackThread(thread) {
    const typeIcon = getTypeIcon(thread.type);
    const submittedDate = new Date(thread.created_at).toLocaleString();

    let html = `
        <div class="feedback-thread">
            <div class="thread-header">
                <h3>
                    ${typeIcon} ${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)}
                    <span class="status-badge status-${thread.status}">${thread.status}</span>
                </h3>
                <p class="thread-date">Submitted: ${submittedDate}</p>
            </div>

            <div class="thread-original-post">
                <div class="post-author">
                    <strong>You</strong> wrote:
                </div>
                <div class="post-content">
                    ${thread.content}
                </div>
            </div>

            <div class="thread-replies">
    `;

    if (thread.replies && thread.replies.length > 0) {
        thread.replies.forEach(reply => {
            const replyDate = new Date(reply.created_at).toLocaleString();
            html += `
                <div class="reply-item">
                    <div class="reply-header">
                        <strong>Admin Response</strong> by ${reply.admin_username || 'System'}
                        <span class="reply-date">${replyDate}</span>
                    </div>
                    <div class="reply-content">
                        ${reply.reply_text}
                    </div>
                </div>
            `;
        });
    } else {
        html += `
            <div class="no-replies">
                <p>📭 No responses yet</p>
                <p class="help-text">Our team will review and respond to your feedback soon.</p>
            </div>
        `;
    }

    html += `
            </div>

            <div class="thread-footer">
                <p class="help-text">Check back here to see admin responses to your feedback.</p>
            </div>
        </div>
    `;

    return html;
}

/**
 * Helper functions
 */
function getStatusClass(status) {
    const classes = {
        'pending': 'status-pending',
        'reviewed': 'status-reviewed',
        'resolved': 'status-resolved',
        'closed': 'status-closed'
    };
    return classes[status] || '';
}

function getTypeIcon(type) {
    const icons = {
        'comment': '💬',
        'feature': '✨',
        'bug': '🐛'
    };
    return icons[type] || '📝';
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Export for use in other modules
export { loadMyFeedback, viewFeedbackThread };
