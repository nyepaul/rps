import { apiClient } from '../../api/client.js';
import { showError, showSuccess, copyToClipboard } from '../../utils/dom.js';

export function renderPasswordRequests(container) {
    container.innerHTML = `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">🔑 Password Reset Requests</h3>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="tokenSearch" placeholder="Filter by Token..." style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    <button id="refreshRequestsBtn" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; cursor: pointer; color: var(--text-primary); font-size: 13px; font-weight: 600;">
                        🔄 Refresh
                    </button>
                </div>
            </div>
            <div id="requestsTableContainer"></div>
        </div>
    `;
    
    document.getElementById('refreshRequestsBtn').addEventListener('click', loadRequests);
    document.getElementById('tokenSearch').addEventListener('input', (e) => {
        const term = e.target.value.toUpperCase();
        const items = document.querySelectorAll('.password-request-item');
        items.forEach(item => {
            const token = item.dataset.token || '';
            const user = item.dataset.username.toUpperCase();
            if (token.includes(term) || user.includes(term)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });
    
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
                <div class="password-request-item" data-id="${req.id}" data-username="${req.username}" data-token="${req.support_token || ''}" style="
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    padding: 10px 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.borderColor='var(--accent-color)'; this.style.transform='translateX(4px)'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateX(0)'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
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
                            
                            ${req.support_token ? `<span style="font-family: monospace; font-weight: 700; background: var(--bg-primary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--accent-color);">${req.support_token}</span>` : ''}
                            
                            <span style="font-size: 12px; color: var(--text-primary); font-weight: 600;">👤 ${req.username}</span>
                            <span style="font-size: 11px; color: var(--text-secondary);">(${req.email})</span>
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
        item.addEventListener('click', () => handleReset(item.dataset.id, item.dataset.username, item.dataset.token));
    });
}

function handleReset(reqId, username, supportToken) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
    
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <h3 style="margin: 0;">Process Request: ${username}</h3>
                ${supportToken ? `<div style="background: var(--accent-bg); color: var(--accent-color); padding: 4px 8px; border-radius: 6px; font-family: monospace; font-weight: bold;">${supportToken}</div>` : ''}
            </div>
            
            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 25px;">
                Choose how to handle this password reset request. Verify the user's identity first.
            </p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <!-- Option A: Generate Link -->
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; cursor: pointer;" onclick="document.getElementById('opt-link').checked = true">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <input type="radio" name="reset-method" id="opt-link" value="link" checked>
                        <label for="opt-link" style="font-weight: 600; cursor: pointer;">Generate Link</label>
                    </div>
                    <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
                        Create a secure, one-time link. Send this to the user so they can set their own password.
                        <br><strong style="color: var(--success-color);">Best for Security</strong>
                    </p>
                </div>

                <!-- Option B: Manual Reset -->
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; cursor: pointer;" onclick="document.getElementById('opt-manual').checked = true">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <input type="radio" name="reset-method" id="opt-manual" value="manual">
                        <label for="opt-manual" style="font-weight: 600; cursor: pointer;">Manual Reset</label>
                    </div>
                    <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
                        Manually set a temporary password.
                        <br><strong style="color: var(--danger-color);">⚠️ Data Loss Likely</strong>
                    </p>
                </div>
            </div>

            <div id="manual-pw-field" style="margin-bottom: 20px; display: none;">
                <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">New Password</label>
                <input type="text" id="new-password" placeholder="Min 8 chars" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary);">
            </div>

            <div style="display: flex; gap: 10px; justify-content: space-between; margin-top: 25px;">
                <button class="delete-req-btn" style="padding: 10px 16px; background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color); border-radius: 6px; cursor: pointer;">Delete Request</button>
                <div style="display: flex; gap: 10px;">
                    <button class="cancel-modal-btn" style="padding: 10px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button class="process-reset-btn" style="padding: 10px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Process</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Toggle manual password field
    const radios = modal.querySelectorAll('input[name="reset-method"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const field = modal.querySelector('#manual-pw-field');
            field.style.display = e.target.value === 'manual' ? 'block' : 'none';
        });
    });

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

    // Process Request
    modal.querySelector('.process-reset-btn').addEventListener('click', async () => {
        const method = modal.querySelector('input[name="reset-method"]:checked').value;
        const payload = { action: method === 'link' ? 'generate_link' : 'manual_reset' };

        if (method === 'manual') {
            const newPw = modal.querySelector('#new-password').value;
            if (!newPw || newPw.length < 8) {
                showError('Password must be at least 8 characters');
                return;
            }
            payload.new_password = newPw;
        }

        try {
            const result = await apiClient.post(`/api/admin/password-requests/${reqId}/reset`, payload);
            
            modal.remove();
            
            if (method === 'link') {
                // Show link modal
                showLinkModal(result.reset_link, username);
            } else {
                let msg = result.message;
                if (result.dek_lost) {
                    msg += '\n\n⚠️ Encrypted data was LOST.';
                }
                alert(msg);
            }
            
            loadRequests();
        } catch (error) {
            showError(error.message || 'Network error occurred');
        }
    });
}

function showLinkModal(link, username) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100;`;
    
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">🔗</div>
            <h3 style="margin: 0 0 10px 0;">Reset Link Generated</h3>
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">
                Send this secure link to <strong>${username}</strong> via a verified channel.
                <br>It expires in 24 hours.
            </p>
            
            <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 20px; word-break: break-all; font-family: monospace; font-size: 13px; color: var(--accent-color);">
                ${link}
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="copy-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Copy Link</button>
                <button class="close-btn" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.copy-btn').addEventListener('click', () => {
        copyToClipboard(link);
        showSuccess('Link copied to clipboard');
    });
    
    modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
}
