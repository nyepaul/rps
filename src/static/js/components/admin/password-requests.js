import { apiClient } from '../../api/client.js';
import { showError, showSuccess } from '../../utils/dom.js';

export function renderPasswordRequests(container) {
    container.innerHTML = `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">🔑 Password Reset Requests</h3>
                <button id="refreshRequestsBtn" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; cursor: pointer; color: var(--text-primary); font-size: 13px; font-weight: 600;">
                    🔄 Refresh
                </button>
            </div>
            <div id="requestsTableContainer"></div>
        </div>
    `;
    
    document.getElementById('refreshRequestsBtn').addEventListener('click', loadRequests);
    loadRequests();
}

async function loadRequests() {
    try {
        const requests = await apiClient.get('/api/admin/password-requests');
        renderTable(requests);
    } catch (error) {
        document.getElementById('requestsTableContainer').innerHTML = `<div class="error" style="color: var(--danger-color); padding: 10px; background: var(--danger-bg); border-radius: 6px; font-size: 13px;">Failed to load requests: ${error.message}</div>`;
    }
}

function renderTable(requests) {
    const container = document.getElementById('requestsTableContainer');
    if (!Array.isArray(requests) || requests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary); background: var(--bg-secondary); border-radius: 12px;">
                <div style="font-size: 48px; margin-bottom: 15px;">📪</div>
                <div>No pending password reset requests</div>
            </div>
        `;
        return;
    }

    const html = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${requests.map(req => `
                <div class="password-request-item" data-id="${req.id}" data-username="${req.username}" style="
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    padding: 10px 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.borderColor='var(--accent-color)'; this.style.transform='translateX(4px)'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateX(0)'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <span style="
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                padding: 2px 8px;
                                background: #f59e0b22;
                                color: #f59e0b;
                                border-radius: 10px;
                                font-size: 11px;
                                font-weight: 700;
                                text-transform: uppercase;
                            ">🔑 Reset Request</span>
                            <span style="font-size: 12px; color: var(--text-primary); font-weight: 600;">👤 ${req.username}</span>
                            <span style="font-size: 11px; color: var(--text-secondary);">(${req.email})</span>
                            ${req.request_ip ? `<span style="font-size: 11px; color: var(--text-secondary); font-family: monospace; opacity: 0.7;">• ${req.request_ip}</span>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;">
                                ${new Date(req.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.password-request-item').forEach(item => {
        item.addEventListener('click', () => handleReset(item.dataset.id, item.dataset.username));
    });
}

function handleReset(reqId, username) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
    
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 450px; width: 90%;">
            <h3 style="margin-top: 0;">Process Request: ${username}</h3>
            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;">
                Reset the user's password or delete this request.
            </p>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">New Password</label>
                <input type="text" id="new-password" placeholder="Min 8 chars" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>

            <div style="display: flex; gap: 10px; justify-content: space-between; margin-top: 25px;">
                <button class="delete-req-btn" style="padding: 10px 16px; background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color); border-radius: 6px; cursor: pointer;">Delete Request</button>
                <div style="display: flex; gap: 10px;">
                    <button class="cancel-modal-btn" style="padding: 10px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button class="process-reset-btn" style="padding: 10px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset Password</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.cancel-modal-btn').addEventListener('click', () => modal.remove());

    // Delete Request
    modal.querySelector('.delete-req-btn').addEventListener('click', async () => {
        if (confirm('Delete this password reset request?')) {
            try {
                await apiClient.delete(`/api/admin/password-requests/${reqId}`);
                showSuccess('Request deleted');
                modal.remove();
                loadRequests();
            } catch (error) {
                showError(error.message);
            }
        }
    });

    // Reset Password
    modal.querySelector('.process-reset-btn').addEventListener('click', async () => {
        const newPassword = modal.querySelector('#new-password').value;
        
        if (!newPassword || newPassword.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }

        try {
            const result = await apiClient.post(`/api/admin/password-requests/${reqId}/reset`, {
                new_password: newPassword
            });
            
            let msg = result.message;
            if (result.recovery_method === 'email_backup') {
                msg += '\n\n✅ Data Preserved (re-encrypted via email backup key).';
            } else {
                msg += '\n\n⚠️ Data LOST (forced reset - no backup available).';
            }
            alert(msg);
            modal.remove();
            loadRequests();
        } catch (error) {
            showError(error.message || 'Network error occurred while processing request');
        }
    });
}
