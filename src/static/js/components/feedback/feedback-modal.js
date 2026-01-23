/**
 * Feedback Modal Component
 * Allows users to submit comments, feature requests, and bug reports
 * Also displays user's feedback history with admin replies
 */

/**
 * Collect comprehensive browser and system information
 */
function collectBrowserInfo() {
    return {
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || navigator.userLanguage,
        current_url: window.location.href,
        color_depth: window.screen.colorDepth,
        pixel_ratio: window.devicePixelRatio,
        platform: navigator.platform,
        online: navigator.onLine,
        cookie_enabled: navigator.cookieEnabled,
        do_not_track: navigator.doNotTrack
    };
}

/**
 * Collect additional system information
 */
function collectSystemInfo() {
    const info = {
        user_agent: navigator.userAgent,
        vendor: navigator.vendor,
        app_name: navigator.appName,
        app_version: navigator.appVersion
    };

    // Memory info (if available)
    if (navigator.deviceMemory) {
        info.device_memory_gb = navigator.deviceMemory;
    }

    // Connection info (if available)
    if (navigator.connection) {
        info.connection_type = navigator.connection.effectiveType;
        info.connection_downlink = navigator.connection.downlink;
        info.connection_rtt = navigator.connection.rtt;
    }

    // Hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency) {
        info.cpu_cores = navigator.hardwareConcurrency;
    }

    return info;
}

/**
 * Submit feedback to the server
 */
async function submitFeedback(type, content) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: JSON.stringify({
            type,
            content,
            browser_info: collectBrowserInfo(),
            system_info: collectSystemInfo()
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit feedback');
    }

    return await response.json();
}

/**
 * Show success message after submission
 */
function showSuccessMessage(container, switchToHistory) {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h3 style="color: var(--success-color); margin: 0 0 12px 0;">Thank You!</h3>
            <p style="color: var(--text-secondary); margin: 0 0 20px 0;">
                Your feedback has been submitted successfully. We appreciate your input!
            </p>
            <button id="view-my-feedback-btn" style="
                padding: 10px 20px;
                background: linear-gradient(135deg, #1098ad, #15aabf);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                color: white;
            ">View My Feedback</button>
        </div>
    `;

    document.getElementById('view-my-feedback-btn').addEventListener('click', switchToHistory);
}

/**
 * Show error message
 */
function showError(container, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: var(--danger-bg);
        color: var(--danger-color);
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 16px;
        border-left: 4px solid var(--danger-color);
    `;
    errorDiv.textContent = message;

    const existingError = container.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    container.insertBefore(errorDiv, container.firstChild);
}

/**
 * Helper functions for My Feedback
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

/**
 * Load user's feedback from API
 */
async function loadMyFeedbackInModal(listContainer, typeFilter, statusFilter) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading your feedback...</div>';

    try {
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
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <p style="margin: 0 0 8px 0; font-weight: 600;">No feedback found</p>
                    <p style="margin: 0; font-size: 14px;">Submit your first feedback using the "Submit" tab</p>
                </div>
            `;
            return;
        }

        renderFeedbackListInModal(listContainer, data.feedback);

    } catch (error) {
        console.error('Error loading feedback:', error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger-color);">
                Failed to load feedback. Please try again.
            </div>
        `;
    }
}

/**
 * Render feedback list in modal
 */
function renderFeedbackListInModal(listContainer, feedbackItems) {
    const html = feedbackItems.map(item => {
        const hasReplies = item.last_reply_at !== null;
        const typeIcon = getTypeIcon(item.type);
        const date = new Date(item.created_at).toLocaleDateString();

        return `
            <div class="modal-feedback-item" data-id="${item.id}" style="
                padding: 16px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 12px;
                background: var(--bg-tertiary);
                cursor: pointer;
                transition: all 0.2s;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="
                            background: var(--bg-secondary);
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 12px;
                            font-weight: 600;
                        ">${typeIcon} ${item.type}</span>
                        <span class="status-badge status-${item.status}" style="
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 11px;
                            font-weight: 600;
                            text-transform: uppercase;
                        ">${item.status}</span>
                        ${hasReplies ? '<span style="font-size: 12px; color: var(--success-color);">💬 Has Reply</span>' : ''}
                    </div>
                    <span style="font-size: 12px; color: var(--text-secondary);">${date}</span>
                </div>
                <div style="color: var(--text-primary); font-size: 14px; line-height: 1.5;">
                    ${truncateText(item.content, 150)}
                </div>
            </div>
        `;
    }).join('');

    listContainer.innerHTML = html;

    // Add click handlers
    listContainer.querySelectorAll('.modal-feedback-item').forEach(item => {
        item.addEventListener('click', async () => {
            const feedbackId = item.getAttribute('data-id');
            await viewFeedbackThreadInModal(listContainer, feedbackId);
        });
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = '#1098ad';
        });
        item.addEventListener('mouseleave', () => {
            item.style.borderColor = 'var(--border-color)';
        });
    });
}

/**
 * View feedback thread in modal
 */
async function viewFeedbackThreadInModal(container, feedbackId) {
    const originalContent = container.innerHTML;
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading thread...</div>';

    try {
        const response = await fetch(`/api/feedback/my/${feedbackId}/thread`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const thread = await response.json();
        renderFeedbackThreadInModal(container, thread, originalContent);

    } catch (error) {
        console.error('Error loading thread:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger-color);">
                Failed to load thread.
                <button id="back-to-list-btn" style="
                    display: block;
                    margin: 16px auto 0;
                    padding: 8px 16px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    cursor: pointer;
                    color: var(--text-primary);
                ">Back to list</button>
            </div>
        `;
        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            container.innerHTML = originalContent;
            // Re-attach event listeners
            container.querySelectorAll('.modal-feedback-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const id = item.getAttribute('data-id');
                    await viewFeedbackThreadInModal(container, id);
                });
            });
        });
    }
}

/**
 * Render feedback thread in modal
 */
function renderFeedbackThreadInModal(container, thread, originalContent) {
    const typeIcon = getTypeIcon(thread.type);
    const submittedDate = new Date(thread.created_at).toLocaleString();
    const isClosed = thread.status === 'closed';

    let repliesHtml = '';
    if (thread.replies && thread.replies.length > 0) {
        repliesHtml = thread.replies.map(reply => {
            const replyDate = new Date(reply.created_at).toLocaleString();
            const isUserReply = reply.admin_id === thread.user_id;
            
            if (isUserReply) {
                // User's own reply
                return `
                    <div style="
                        padding: 12px;
                        background: var(--bg-primary);
                        border-right: 3px solid var(--text-secondary);
                        border-radius: 8px 0 0 8px;
                        margin-bottom: 12px;
                        margin-left: 20px;
                        text-align: right;
                    ">
                        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 8px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">${replyDate}</span>
                            <strong style="color: var(--text-primary);">You</strong>
                        </div>
                        <div style="color: var(--text-primary); line-height: 1.5; white-space: pre-wrap;">${reply.reply_text}</div>
                    </div>
                `;
            } else {
                // Admin reply
                return `
                    <div style="
                        padding: 12px;
                        background: var(--bg-secondary);
                        border-left: 3px solid #1098ad;
                        border-radius: 0 8px 8px 0;
                        margin-bottom: 12px;
                        margin-right: 20px;
                    ">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <strong style="color: #1098ad;">Support Team</strong>
                            <span style="font-size: 12px; color: var(--text-secondary);">${replyDate}</span>
                        </div>
                        <div style="color: var(--text-primary); line-height: 1.5; white-space: pre-wrap;">${reply.reply_text}</div>
                    </div>
                `;
            }
        }).join('');
    } else {
        repliesHtml = `
            <div style="text-align: center; padding: 24px; color: var(--text-secondary);">
                <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
                <p style="margin: 0 0 4px 0; font-weight: 600;">No responses yet</p>
                <p style="margin: 0; font-size: 13px;">Our team will review your feedback soon.</p>
            </div>
        `;
    }

    container.innerHTML = `
        <div>
            <button id="back-to-list-btn" style="
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 12px;
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                cursor: pointer;
                color: var(--text-primary);
                font-size: 13px;
                margin-bottom: 16px;
            ">← Back to list</button>

            <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 18px;">${typeIcon}</span>
                    <span style="font-weight: 600; font-size: 16px; text-transform: capitalize;">${thread.type}</span>
                    <span class="status-badge status-${thread.status}" style="
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                    ">${thread.status}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">Submitted: ${submittedDate}</div>
            </div>

            <div style="
                padding: 16px;
                background: var(--bg-tertiary);
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid var(--border-color);
            ">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Your feedback:</div>
                <div style="color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;">${thread.content}</div>
            </div>

            <div style="margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Discussion</div>
            <div style="margin-bottom: 20px;">
                ${repliesHtml}
            </div>

            ${!isClosed ? `
                <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h4 style="font-size: 14px; margin: 0 0 10px 0;">Add a reply</h4>
                    <textarea id="user-reply-text" style="
                        width: 100%;
                        min-height: 80px;
                        padding: 10px;
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-family: inherit;
                        font-size: 14px;
                        resize: vertical;
                        margin-bottom: 10px;
                    " placeholder="Type your reply here..."></textarea>
                    <div style="display: flex; justify-content: flex-end;">
                        <button id="submit-user-reply" style="
                            padding: 8px 16px;
                            background: var(--accent-color);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 13px;
                        ">Send Reply</button>
                    </div>
                </div>
            ` : `
                <div style="
                    padding: 12px;
                    background: var(--bg-tertiary);
                    border-radius: 6px;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 13px;
                    font-style: italic;
                ">
                    This ticket is closed. Replies are disabled.
                </div>
            `}
        </div>
    `;

    // Handle back button
    document.getElementById('back-to-list-btn').addEventListener('click', () => {
        container.innerHTML = originalContent;
        // Re-attach event listeners for list items
        container.querySelectorAll('.modal-feedback-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.getAttribute('data-id');
                await viewFeedbackThreadInModal(container, id);
            });
            item.addEventListener('mouseenter', () => item.style.borderColor = '#1098ad');
            item.addEventListener('mouseleave', () => item.style.borderColor = 'var(--border-color)');
        });
    });

    // Handle reply submission
    const replyBtn = document.getElementById('submit-user-reply');
    if (replyBtn) {
        replyBtn.addEventListener('click', async () => {
            const text = document.getElementById('user-reply-text').value.trim();
            if (!text) return;

            replyBtn.disabled = true;
            replyBtn.textContent = 'Sending...';

            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
                const response = await fetch(`/api/feedback/${thread.id}/replies`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(csrfToken && { 'X-CSRF-Token': csrfToken })
                    },
                    body: JSON.stringify({ reply_text: text })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to send reply');
                }

                // Reload thread
                await viewFeedbackThreadInModal(container, thread.id);

            } catch (error) {
                alert(`Error: ${error.message}`);
                replyBtn.disabled = false;
                replyBtn.textContent = 'Send Reply';
            }
        });
    }
}

/**
 * Render feedback modal with tabs
 */
export function renderFeedbackModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'feedback-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
    `;

    content.innerHTML = `
        <div style="padding: 24px; border-bottom: 2px solid var(--border-color); background: linear-gradient(135deg, #1098ad, #15aabf); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">
                        💬 Feedback
                    </h2>
                    <p style="margin: 0; font-size: 14px; opacity: 0.95;">
                        Share your thoughts or view your feedback history
                    </p>
                </div>
                <button id="close-feedback-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                    ×
                </button>
            </div>
        </div>

        <!-- Tab Navigation -->
        <div style="display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
            <button class="feedback-modal-tab active" data-tab="submit" style="
                flex: 1;
                padding: 12px 16px;
                border: none;
                background: transparent;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary);
                border-bottom: 2px solid #1098ad;
                transition: all 0.2s;
            ">✏️ Submit Feedback</button>
            <button class="feedback-modal-tab" data-tab="history" style="
                flex: 1;
                padding: 12px 16px;
                border: none;
                background: transparent;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-secondary);
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            ">📋 My Feedback</button>
        </div>

        <!-- Tab Content Container -->
        <div id="feedback-modal-content" style="flex: 1; overflow-y: auto;">
            <!-- Submit Tab (default) -->
            <div id="submit-tab-content" style="padding: 24px;">
                <form id="feedback-form">
                    <!-- Type Selection -->
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            What would you like to share?
                        </label>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                            <label class="feedback-type-option" style="cursor: pointer;">
                                <input type="radio" name="feedback-type" value="comment" required style="display: none;">
                                <div class="type-card" data-type="comment" style="
                                    padding: 16px;
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    text-align: center;
                                    transition: all 0.2s;
                                    background: var(--bg-tertiary);
                                ">
                                    <div style="font-size: 32px; margin-bottom: 8px;">💭</div>
                                    <div style="font-weight: 600; font-size: 14px;">Comment</div>
                                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">General feedback</div>
                                </div>
                            </label>

                            <label class="feedback-type-option" style="cursor: pointer;">
                                <input type="radio" name="feedback-type" value="feature" required style="display: none;">
                                <div class="type-card" data-type="feature" style="
                                    padding: 16px;
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    text-align: center;
                                    transition: all 0.2s;
                                    background: var(--bg-tertiary);
                                ">
                                    <div style="font-size: 32px; margin-bottom: 8px;">💡</div>
                                    <div style="font-weight: 600; font-size: 14px;">Feature</div>
                                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Request new feature</div>
                                </div>
                            </label>

                            <label class="feedback-type-option" style="cursor: pointer;">
                                <input type="radio" name="feedback-type" value="bug" required style="display: none;">
                                <div class="type-card" data-type="bug" style="
                                    padding: 16px;
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    text-align: center;
                                    transition: all 0.2s;
                                    background: var(--bg-tertiary);
                                ">
                                    <div style="font-size: 32px; margin-bottom: 8px;">🐛</div>
                                    <div style="font-weight: 600; font-size: 14px;">Bug</div>
                                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Report an issue</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Content -->
                    <div style="margin-bottom: 20px;">
                        <label for="feedback-content" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            Details
                        </label>
                        <textarea
                            id="feedback-content"
                            name="content"
                            required
                            placeholder="Please provide as much detail as possible..."
                            style="
                                width: 100%;
                                min-height: 150px;
                                padding: 12px;
                                border: 2px solid var(--border-color);
                                border-radius: 8px;
                                font-family: inherit;
                                font-size: 14px;
                                resize: vertical;
                                background: var(--bg-tertiary);
                                color: var(--text-primary);
                            "
                        ></textarea>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                            Maximum 10,000 characters
                        </div>
                    </div>

                    <!-- Buttons -->
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" id="cancel-feedback" style="
                            padding: 10px 20px;
                            background: var(--bg-tertiary);
                            border: 2px solid var(--border-color);
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            color: var(--text-primary);
                            transition: all 0.2s;
                        ">
                            Cancel
                        </button>
                        <button type="submit" id="submit-feedback" style="
                            padding: 10px 20px;
                            background: linear-gradient(135deg, #1098ad, #15aabf);
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            color: white;
                            transition: all 0.2s;
                        ">
                            Submit Feedback
                        </button>
                    </div>
                </form>
            </div>

            <!-- History Tab (hidden by default) -->
            <div id="history-tab-content" style="padding: 24px; display: none;">
                <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                    <select id="modal-filter-type" style="
                        padding: 8px 12px;
                        border: 1px solid var(--border-color);
                        border-radius: 4px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-size: 13px;
                    ">
                        <option value="">All Types</option>
                        <option value="comment">Comment</option>
                        <option value="feature">Feature</option>
                        <option value="bug">Bug</option>
                    </select>
                    <select id="modal-filter-status" style="
                        padding: 8px 12px;
                        border: 1px solid var(--border-color);
                        border-radius: 4px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-size: 13px;
                    ">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                    <button id="modal-refresh-feedback" style="
                        padding: 8px 12px;
                        border: 1px solid var(--border-color);
                        border-radius: 4px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        cursor: pointer;
                        font-size: 13px;
                    ">🔄 Refresh</button>
                </div>
                <div id="modal-feedback-list"></div>
            </div>
        </div>
    `;

    modal.appendChild(content);

    // Tab switching
    const tabs = content.querySelectorAll('.feedback-modal-tab');
    const submitContent = content.querySelector('#submit-tab-content');
    const historyContent = content.querySelector('#history-tab-content');

    function switchTab(tabName) {
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.style.borderBottomColor = '#1098ad';
                tab.style.color = 'var(--text-primary)';
            } else {
                tab.style.borderBottomColor = 'transparent';
                tab.style.color = 'var(--text-secondary)';
            }
        });

        if (tabName === 'submit') {
            submitContent.style.display = 'block';
            historyContent.style.display = 'none';
        } else {
            submitContent.style.display = 'none';
            historyContent.style.display = 'block';
            // Load feedback when switching to history tab
            const typeFilter = content.querySelector('#modal-filter-type').value;
            const statusFilter = content.querySelector('#modal-filter-status').value;
            loadMyFeedbackInModal(content.querySelector('#modal-feedback-list'), typeFilter, statusFilter);
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.getAttribute('data-tab'));
        });
    });

    // History tab filters
    content.querySelector('#modal-filter-type').addEventListener('change', () => {
        const typeFilter = content.querySelector('#modal-filter-type').value;
        const statusFilter = content.querySelector('#modal-filter-status').value;
        loadMyFeedbackInModal(content.querySelector('#modal-feedback-list'), typeFilter, statusFilter);
    });

    content.querySelector('#modal-filter-status').addEventListener('change', () => {
        const typeFilter = content.querySelector('#modal-filter-type').value;
        const statusFilter = content.querySelector('#modal-filter-status').value;
        loadMyFeedbackInModal(content.querySelector('#modal-feedback-list'), typeFilter, statusFilter);
    });

    content.querySelector('#modal-refresh-feedback').addEventListener('click', () => {
        const typeFilter = content.querySelector('#modal-filter-type').value;
        const statusFilter = content.querySelector('#modal-filter-status').value;
        loadMyFeedbackInModal(content.querySelector('#modal-feedback-list'), typeFilter, statusFilter);
    });

    // Add event listeners for type selection
    const typeCards = content.querySelectorAll('.type-card');
    const typeInputs = content.querySelectorAll('input[name="feedback-type"]');

    typeInputs.forEach((input, index) => {
        input.addEventListener('change', () => {
            typeCards.forEach(card => {
                card.style.borderColor = 'var(--border-color)';
                card.style.background = 'var(--bg-tertiary)';
            });
            if (input.checked) {
                typeCards[index].style.borderColor = '#1098ad';
                typeCards[index].style.background = 'rgba(16, 152, 173, 0.1)';
            }
        });
    });

    // Click on card selects the radio
    typeCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            typeInputs[index].checked = true;
            typeInputs[index].dispatchEvent(new Event('change'));
        });
    });

    // Form submission
    const form = content.querySelector('#feedback-form');
    const submitBtn = content.querySelector('#submit-feedback');
    const formContainer = content.querySelector('#submit-tab-content');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = form.querySelector('input[name="feedback-type"]:checked')?.value;
        const contentText = form.querySelector('#feedback-content').value.trim();

        if (!type) {
            showError(formContainer, 'Please select a feedback type');
            return;
        }

        if (!contentText) {
            showError(formContainer, 'Please provide feedback details');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            await submitFeedback(type, contentText);
            showSuccessMessage(formContainer, () => switchTab('history'));
        } catch (error) {
            showError(formContainer, error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
        }
    });

    // Close button
    const closeBtn = content.querySelector('#close-feedback-modal');
    closeBtn.addEventListener('click', () => modal.remove());

    // Cancel button
    const cancelBtn = content.querySelector('#cancel-feedback');
    cancelBtn.addEventListener('click', () => modal.remove());

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    return modal;
}

/**
 * Show feedback modal
 */
export function showFeedbackModal() {
    // Remove existing modal if any
    const existing = document.getElementById('feedback-modal');
    if (existing) {
        existing.remove();
    }

    const modal = renderFeedbackModal();
    document.body.appendChild(modal);
}
