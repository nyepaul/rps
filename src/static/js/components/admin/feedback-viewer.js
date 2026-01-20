/**
 * Feedback Viewer Component (Admin)
 * Display and manage user feedback submissions
 */

import { apiClient } from '../../api/client.js';
import { showError, showSuccess } from '../../utils/dom.js';
import { store } from '../../state/store.js';

/**
 * Format timestamp
 */
function formatTimestamp(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get type badge HTML
 */
function getTypeBadge(type) {
    const badges = {
        'comment': { emoji: '💭', color: '#1098ad', label: 'Comment' },
        'feature': { emoji: '💡', color: '#f59f00', label: 'Feature' },
        'bug': { emoji: '🐛', color: '#e03131', label: 'Bug' }
    };
    const badge = badges[type] || { emoji: '❓', color: '#868e96', label: type };
    return `
        <span style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: ${badge.color}22;
            color: ${badge.color};
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        ">
            ${badge.emoji} ${badge.label}
        </span>
    `;
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const badges = {
        'pending': { color: '#868e96', label: 'Pending' },
        'reviewed': { color: '#1098ad', label: 'Reviewed' },
        'resolved': { color: '#37b24d', label: 'Resolved' },
        'closed': { color: '#495057', label: 'Closed' }
    };
    const badge = badges[status] || { color: '#868e96', label: status };
    return `
        <span style="
            padding: 4px 10px;
            background: ${badge.color}22;
            color: ${badge.color};
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        ">
            ${badge.label}
        </span>
    `;
}

/**
 * Get content HTML based on super admin status
 */
function getContentHtml(isSuperAdmin, content, contentLoadError) {
    if (!isSuperAdmin) {
        return '';
    }

    let contentDisplay = '';
    if (content) {
        contentDisplay = `
            <div style="
                background: var(--bg-tertiary);
                padding: 16px;
                border-radius: 8px;
                border-left: 4px solid var(--accent-color);
                white-space: pre-wrap;
                word-wrap: break-word;
            ">
                ${content}
            </div>
        `;
    } else if (contentLoadError) {
        contentDisplay = `
            <div style="
                background: var(--danger-bg);
                padding: 16px;
                border-radius: 8px;
                border-left: 4px solid var(--danger-color);
                color: var(--danger-color);
            ">
                ⚠️ Error loading content
            </div>
        `;
    } else {
        contentDisplay = `
            <div style="
                background: var(--bg-tertiary);
                padding: 16px;
                border-radius: 8px;
                text-align: center;
                color: var(--text-secondary);
            ">
                ⏳ Loading content...
            </div>
        `;
    }

    return `
        <!-- Feedback Content (Super Admin Only) -->
        <div style="margin-bottom: 24px;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: var(--text-primary);">
                Content
            </h3>
            ${contentDisplay}
        </div>
    `;
}

/**
 * Render feedback details modal
 */
async function showFeedbackDetails(feedback) {
    const currentUser = store.get('currentUser');
    const isSuperAdmin = currentUser?.is_super_admin || false;

    // Fetch content if super admin
    let content = null;
    let contentLoadError = false;

    if (isSuperAdmin) {
        try {
            const contentData = await apiClient.get(`/api/feedback/${feedback.id}/content`);
            content = contentData.content;
        } catch (error) {
            console.error('Error loading feedback content:', error);
            contentLoadError = true;
        }
    }

    // Fetch thread with replies
    let thread = null;
    try {
        thread = await apiClient.get(`/api/feedback/${feedback.id}/thread`);
    } catch (error) {
        console.error('Error loading feedback thread:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
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

    // Parse admin notes if it's JSON
    let systemInfo = null;
    if (feedback.admin_notes) {
        try {
            const parsed = JSON.parse(feedback.admin_notes);
            systemInfo = parsed.system_info;
        } catch (e) {
            // Not JSON, just regular text
        }
    }

    modal.innerHTML = `
        <div style="
            background: var(--bg-secondary);
            border-radius: 12px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        ">
            <!-- Header -->
            <div style="padding: 24px; border-bottom: 2px solid var(--border-color); background: var(--bg-tertiary);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">
                            Feedback Details
                        </h2>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${getTypeBadge(feedback.type)}
                            ${getStatusBadge(feedback.status)}
                        </div>
                    </div>
                    <button class="close-modal" style="
                        background: var(--bg-tertiary);
                        border: 1px solid var(--border-color);
                        color: var(--text-primary);
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 18px;
                        font-weight: bold;
                    ">×</button>
                </div>
            </div>

            <!-- Content -->
            <div style="padding: 24px;">
                ${getContentHtml(isSuperAdmin, content, contentLoadError)}

                <!-- Metadata -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">User ID</div>
                        <div style="font-weight: 600;">${feedback.user_id}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Submitted</div>
                        <div style="font-weight: 600;">${formatTimestamp(feedback.created_at)}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">IP Address</div>
                        <div style="font-weight: 600; font-family: monospace; font-size: 13px;">${feedback.ip_address || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Browser</div>
                        <div style="font-weight: 600;">${feedback.browser_name || 'Unknown'} ${feedback.browser_version || ''}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">OS</div>
                        <div style="font-weight: 600;">${feedback.os_name || 'Unknown'} ${feedback.os_version || ''}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Device</div>
                        <div style="font-weight: 600;">${feedback.device_type || 'Unknown'}</div>
                    </div>
                    ${feedback.screen_resolution ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Screen</div>
                            <div style="font-weight: 600;">${feedback.screen_resolution}</div>
                        </div>
                    ` : ''}
                    ${feedback.timezone ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Timezone</div>
                            <div style="font-weight: 600;">${feedback.timezone}</div>
                        </div>
                    ` : ''}
                </div>

                <!-- System Info (if available) -->
                ${systemInfo ? `
                    <details style="margin-bottom: 24px;">
                        <summary style="cursor: pointer; font-weight: 600; padding: 12px; background: var(--bg-tertiary); border-radius: 6px;">
                            🖥️ Technical Details
                        </summary>
                        <div style="padding: 16px; background: var(--bg-tertiary); border-radius: 0 0 6px 6px; margin-top: -6px;">
                            <pre style="
                                font-size: 12px;
                                font-family: monospace;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                                margin: 0;
                            ">${JSON.stringify(systemInfo, null, 2)}</pre>
                        </div>
                    </details>
                ` : ''}

                <!-- Replies Section -->
                ${thread && thread.replies && thread.replies.length > 0 ? `
                    <div style="margin-bottom: 24px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                            💬 Replies (${thread.replies.length})
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${thread.replies.map(reply => `
                                <div style="
                                    background: ${reply.is_private ? '#fff3cd' : '#f8f9fa'};
                                    border-left: 4px solid ${reply.is_private ? '#ffc107' : '#6c757d'};
                                    padding: 16px;
                                    border-radius: 4px;
                                ">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                            ${reply.admin_username || 'System'}
                                            ${reply.is_private ? '<span style="font-size: 11px; background: #ffc107; color: #856404; padding: 2px 6px; border-radius: 3px;">PRIVATE NOTE</span>' : ''}
                                        </div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                            ${formatTimestamp(reply.created_at)}
                                        </div>
                                    </div>
                                    <div style="white-space: pre-wrap; line-height: 1.5;">
                                        ${reply.reply_text}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Add Reply Form -->
                <div style="margin-bottom: 24px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                        ✍️ Add Reply
                    </h3>
                    <textarea id="reply-text" style="
                        width: 100%;
                        min-height: 100px;
                        padding: 12px;
                        border: 2px solid var(--border-color);
                        border-radius: 6px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-size: 14px;
                        font-family: inherit;
                        resize: vertical;
                        margin-bottom: 12px;
                    " placeholder="Write your reply to the user..."></textarea>
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="is-private-reply" style="cursor: pointer;">
                            <span style="font-size: 14px;">🔒 Private note (only visible to admins)</span>
                        </label>
                    </div>
                    <button class="add-reply" data-id="${feedback.id}" style="
                        padding: 10px 20px;
                        background: var(--accent-color);
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        color: white;
                    ">Send Reply</button>
                </div>

                <!-- Admin Actions -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Admin Actions</h3>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">
                            Status
                        </label>
                        <select id="feedback-status" style="
                            width: 100%;
                            padding: 8px;
                            border: 2px solid var(--border-color);
                            border-radius: 6px;
                            background: var(--bg-tertiary);
                            color: var(--text-primary);
                            font-size: 14px;
                        ">
                            <option value="pending" ${feedback.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="reviewed" ${feedback.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                            <option value="resolved" ${feedback.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="closed" ${feedback.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">
                            Admin Notes
                        </label>
                        <textarea id="admin-notes" style="
                            width: 100%;
                            min-height: 80px;
                            padding: 8px;
                            border: 2px solid var(--border-color);
                            border-radius: 6px;
                            background: var(--bg-tertiary);
                            color: var(--text-primary);
                            font-size: 14px;
                            font-family: inherit;
                            resize: vertical;
                        " placeholder="Add notes...">${typeof feedback.admin_notes === 'string' && !systemInfo ? feedback.admin_notes : ''}</textarea>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="delete-feedback" data-id="${feedback.id}" style="
                            padding: 10px 20px;
                            background: var(--danger-color);
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            color: white;
                        ">Delete</button>
                        <button class="update-feedback" data-id="${feedback.id}" style="
                            padding: 10px 20px;
                            background: var(--accent-color);
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            color: white;
                        ">Update</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());

    // Add reply handler
    modal.querySelector('.add-reply').addEventListener('click', async () => {
        const replyText = modal.querySelector('#reply-text').value.trim();
        const isPrivate = modal.querySelector('#is-private-reply').checked;

        if (!replyText) {
            showError('Please enter a reply message');
            return;
        }

        try {
            await apiClient.post(`/api/feedback/${feedback.id}/replies`, {
                reply_text: replyText,
                is_private: isPrivate
            });
            showSuccess(isPrivate ? 'Private note added successfully' : 'Reply sent successfully');
            modal.remove();
            // Reload feedback list
            const container = document.querySelector('#admin-subtab-content');
            if (container) {
                await renderFeedbackViewer(container);
            }
        } catch (error) {
            showError(`Failed to send reply: ${error.message}`);
        }
    });

    modal.querySelector('.delete-feedback').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this feedback?')) {
            try {
                await apiClient.delete(`/api/feedback/${feedback.id}`);
                showSuccess('Feedback deleted successfully');
                modal.remove();
                // Reload feedback list
                const container = document.querySelector('#admin-subtab-content');
                if (container) {
                    await renderFeedbackViewer(container);
                }
            } catch (error) {
                showError(`Failed to delete feedback: ${error.message}`);
            }
        }
    });

    modal.querySelector('.update-feedback').addEventListener('click', async () => {
        const status = modal.querySelector('#feedback-status').value;
        const notes = modal.querySelector('#admin-notes').value.trim();

        try {
            await apiClient.patch(`/api/feedback/${feedback.id}`, {
                status,
                admin_notes: notes
            });
            showSuccess('Feedback updated successfully');
            modal.remove();
            // Reload feedback list
            const container = document.querySelector('#admin-subtab-content');
            if (container) {
                await renderFeedbackViewer(container);
            }
        } catch (error) {
            showError(`Failed to update feedback: ${error.message}`);
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

/**
 * Render feedback viewer
 */
export async function renderFeedbackViewer(container) {
    container.innerHTML = `
        <div>
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 600;">💬 User Feedback</h2>
                <div style="display: flex; gap: 12px;">
                    <select id="filter-type" style="
                        padding: 8px 12px;
                        border: 2px solid var(--border-color);
                        border-radius: 6px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-size: 14px;
                    ">
                        <option value="">All Types</option>
                        <option value="comment">Comments</option>
                        <option value="feature">Features</option>
                        <option value="bug">Bugs</option>
                    </select>
                    <select id="filter-status" style="
                        padding: 8px 12px;
                        border: 2px solid var(--border-color);
                        border-radius: 6px;
                        background: var(--bg-tertiary);
                        color: var(--text-primary);
                        font-size: 14px;
                    ">
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
            </div>
            <div id="feedback-list">
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
                    <div>Loading feedback...</div>
                </div>
            </div>
        </div>
    `;

    // Load feedback
    await loadFeedback(container);

    // Setup filters
    const filterType = container.querySelector('#filter-type');
    const filterStatus = container.querySelector('#filter-status');

    filterType.addEventListener('change', () => loadFeedback(container));
    filterStatus.addEventListener('change', () => loadFeedback(container));
}

/**
 * Load and display feedback
 */
async function loadFeedback(container) {
    const listContainer = container.querySelector('#feedback-list');
    const filterType = container.querySelector('#filter-type')?.value || '';
    const filterStatus = container.querySelector('#filter-status')?.value || '';

    try {
        const params = new URLSearchParams();
        if (filterType) params.append('type', filterType);
        if (filterStatus) params.append('status', filterStatus);
        params.append('limit', '100');

        const data = await apiClient.get(`/api/feedback?${params.toString()}`);
        const feedback = data.feedback || [];

        if (feedback.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No feedback found</div>
                    <div style="color: var(--text-secondary);">No feedback submissions match your filters</div>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${feedback.map(item => `
                    <div class="feedback-item" data-id="${item.id}" style="
                        background: var(--bg-tertiary);
                        border: 2px solid var(--border-color);
                        border-radius: 8px;
                        padding: 16px;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                ${getTypeBadge(item.type)}
                                ${getStatusBadge(item.status)}
                                ${item.reply_count > 0 ? `
                                    <span style="
                                        padding: 4px 10px;
                                        background: #e7f3ff;
                                        color: #004085;
                                        border-radius: 12px;
                                        font-size: 12px;
                                        font-weight: 600;
                                    ">💬 ${item.reply_count} ${item.reply_count === 1 ? 'reply' : 'replies'}</span>
                                ` : ''}
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                ${formatTimestamp(item.created_at)}
                            </div>
                        </div>
                        <div style="display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); flex-wrap: wrap;">
                            <span>👤 User #${item.user_id}</span>
                            ${item.ip_address ? `<span>🌐 ${item.ip_address}</span>` : ''}
                            ${item.browser_name ? `<span>💻 ${item.browser_name}</span>` : ''}
                            ${item.last_reply_at ? `<span>💬 Last reply: ${formatTimestamp(item.last_reply_at)}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Add click handlers
        listContainer.querySelectorAll('.feedback-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.getAttribute('data-id'));
                const feedbackData = feedback.find(f => f.id === id);
                if (feedbackData) {
                    showFeedbackDetails(feedbackData);
                }
            });

            item.addEventListener('mouseenter', () => {
                item.style.borderColor = 'var(--accent-color)';
                item.style.transform = 'translateX(4px)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'var(--border-color)';
                item.style.transform = 'translateX(0)';
            });
        });

    } catch (error) {
        console.error('Error loading feedback:', error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 64px; margin-bottom: 20px;">❌</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--danger-color);">
                    Error Loading Feedback
                </div>
                <div style="color: var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}
