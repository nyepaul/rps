import { apiClient } from '../../api/client.js';
import { showError, showSuccess } from '../../utils/dom.js';

export function renderPasswordRequests(container) {
    container.innerHTML = `
        <div class="admin-card" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333;">Password Reset Requests</h3>
                <button id="refreshRequestsBtn" style="background: #f3f4f6; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                    ↻ Refresh
                </button>
            </div>
            <div id="requestsTableContainer">Loading...</div>
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
        document.getElementById('requestsTableContainer').innerHTML = `<div class="error" style="color: #dc2626; padding: 10px; background: #fee2e2; border-radius: 4px;">Failed to load requests: ${error.message}</div>`;
    }
}

function renderTable(requests) {
    const container = document.getElementById('requestsTableContainer');
    if (!Array.isArray(requests) || requests.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;">No pending requests.</p>';
        return;
    }

    let html = `
        <div style="overflow-x: auto;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;">
                    <th style="padding: 12px; color: #374151; font-weight: 600;">Time</th>
                    <th style="padding: 12px; color: #374151; font-weight: 600;">User</th>
                    <th style="padding: 12px; color: #374151; font-weight: 600;">Email</th>
                    <th style="padding: 12px; color: #374151; font-weight: 600;">IP</th>
                    <th style="padding: 12px; color: #374151; font-weight: 600;">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    requests.forEach(req => {
        html += `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px; color: #4b5563;">${new Date(req.created_at).toLocaleString()}</td>
                <td style="padding: 12px; font-weight: 500; color: #111827;">${req.username}</td>
                <td style="padding: 12px; color: #4b5563;">${req.email}</td>
                <td style="padding: 12px; color: #6b7280; font-family: monospace;">${req.request_ip || 'N/A'}</td>
                <td style="padding: 12px;">
                    <button class="action-btn reset-req-btn" data-id="${req.id}" data-username="${req.username}"
                        style="background: #f59e0b; color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500; transition: background 0.2s;">
                        Process Reset
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    container.querySelectorAll('.reset-req-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReset(btn.dataset.id, btn.dataset.username));
    });
}

async function handleReset(reqId, username) {
    const newPassword = prompt(`Reset password for user "${username}".\n\nEnter the NEW password (min 8 chars):`);
    
    if (newPassword === null) return; // Cancelled
    
    if (!newPassword || newPassword.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }

    // Confirm
    if (!confirm(`Are you sure you want to set the password to "${newPassword}" for ${username}?`)) {
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
        loadRequests(); // Refresh table
    } catch (error) {
        showError(error.message || 'Network error occurred while processing request');
    }
}
