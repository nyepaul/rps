// Account Recovery Logic
// Extracted from inline script to satisfy CSP requirements

// Global Error Handler
window.onerror = function(msg, url, line, col, error) {
    console.error("Global Error:", msg, line, error);
    // alert("System Error: " + msg); // Uncomment for aggressive debugging
    return false;
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Account Recovery Script Loaded");

    // State
    const state = {
        step: 1,
        method: null,
        subMethod: 'email', // Default
        username: '',
        email: '',
        token: null,
        recoveryCode: '',
        oldPassword: '',
        hasEncryptedData: false,
        canRecoverViaEmail: false
    };

    // DOM Helpers
    const get = (id) => document.getElementById(id);
    const show = (id) => { const el = get(id); if (el) el.classList.remove('hidden'); };
    const hide = (id) => { const el = get(id); if (el) el.classList.add('hidden'); };
    const setHtml = (id, html) => { const el = get(id); if (el) el.innerHTML = html; };
    const setText = (id, text) => { const el = get(id); if (el) el.textContent = text; };

    // Views
    const views = ['view-methods', 'view-identity', 'view-reset', 'view-success'];
    
    function switchView(activeViewId) {
        console.log("Switching to view:", activeViewId);
        views.forEach(id => {
            const el = get(id);
            if (el) {
                el.classList.remove('active');
                if (id === activeViewId) el.classList.add('active');
            }
        });

        // Update dots
        const stepMap = { 'view-methods': 1, 'view-identity': 2, 'view-reset': 3, 'view-success': 3 };
        const currentStep = stepMap[activeViewId] || 1;
        document.querySelectorAll('.step-dot').forEach(dot => {
            dot.classList.toggle('active', parseInt(dot.dataset.step) === currentStep);
        });
    }

    // --- Step 1: Selection ---

    // Event Delegation for Method Selection
    const methodGrid = document.querySelector('.method-grid');
    if (methodGrid) {
        methodGrid.addEventListener('click', (e) => {
            const option = e.target.closest('.method-option');
            if (!option) return;

            const method = option.dataset.method;
            console.log("Method selected:", method);
            state.method = method;
            state.subMethod = 'email'; // Reset sub-method
            
            try {
                setupIdentityView();
                switchView('view-identity');
            } catch (err) {
                console.error(err);
                alert("Error initializing view: " + err.message);
            }
        });
    } else {
        console.error("Method grid not found");
    }

    // --- Step 2: Identity Setup ---

    function setupIdentityView() {
        // Reset all fields first
        ['username-field', 'access-choice-field', 'email-field', 'token-field', 'old-password-field', 'recovery-code-field']
            .forEach(hide);
        
        // Clear required attributes
        ['username', 'email', 'manual-token', 'old-password', 'recovery-code']
            .forEach(id => { const el = get(id); if (el) el.required = false; });

        const submitBtn = get('identity-submit');
        show('username-field');
        const usernameInput = get('username');
        if (usernameInput) usernameInput.required = true;

        if (state.method === 'access') {
            setText('title', 'Access Token');
            setText('subtitle', 'Restore account access');
            setHtml('method-alert', '<strong>🎟️ Identity:</strong> Prove ownership via Email link or Admin token.');
            
            show('access-choice-field');
            updateAccessSubMethod(); // Sets up email vs token fields

        } else if (state.method === 'code') {
            setText('title', 'Recovery Code');
            setText('subtitle', 'Restore your data');
            setHtml('method-alert', '<strong>🛡️ Zero-Knowledge:</strong> Enter your registered email and 16-char recovery code.');
            
            show('email-field');
            get('email').required = true;
            show('recovery-code-field');
            get('recovery-code').required = true;
            if (submitBtn) submitBtn.textContent = 'Verify Code';

        } else if (state.method === 'password') {
            setText('title', 'Previous Password');
            setText('subtitle', 'Identity Verification');
            setHtml('method-alert', '<strong>🔄 Password Rotation:</strong> Use your old password to securely set a new one.');
            
            show('email-field');
            get('email').required = true;
            show('old-password-field');
            get('old-password').required = true;
            if (submitBtn) submitBtn.textContent = 'Continue';
        }
    }

    function updateAccessSubMethod() {
        const submitBtn = get('identity-submit');
        const btnEmail = get('btn-choice-email');
        const btnToken = get('btn-choice-token');

        if (state.subMethod === 'email') {
            show('email-field');
            hide('token-field');
            show('username-field');
            if (get('email')) get('email').required = true;
            if (submitBtn) submitBtn.textContent = 'Send Reset Link';
            
            if (btnEmail) { btnEmail.style.background = 'var(--primary)'; btnEmail.style.color = 'white'; }
            if (btnToken) { btnToken.style.background = '#f3f4f6'; btnToken.style.color = '#374151'; }
        } else {
            hide('email-field');
            show('token-field');
            hide('username-field'); // Token is enough
            if (get('manual-token')) get('manual-token').required = true;
            if (submitBtn) submitBtn.textContent = 'Verify Token';

            if (btnEmail) { btnEmail.style.background = '#f3f4f6'; btnEmail.style.color = '#374151'; }
            if (btnToken) { btnToken.style.background = 'var(--primary)'; btnToken.style.color = 'white'; }
        }
    }

    // Sub-method buttons
    const btnEmail = get('btn-choice-email');
    if (btnEmail) btnEmail.addEventListener('click', () => { state.subMethod = 'email'; updateAccessSubMethod(); });
    
    const btnToken = get('btn-choice-token');
    if (btnToken) btnToken.addEventListener('click', () => { state.subMethod = 'token'; updateAccessSubMethod(); });

    const btnBack = get('identity-back');
    if (btnBack) btnBack.addEventListener('click', () => {
        setText('title', 'Account Recovery');
        setText('subtitle', 'Select a method to regain access');
        switchView('view-methods');
    });

    // Form Submission
    const formIdentity = get('identity-form');
    if (formIdentity) {
        formIdentity.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = get('identity-submit');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.innerHTML = 'Processing...';
            setHtml('message-container', ''); // Clear alerts

            // Harvest Values
            state.username = get('username') ? get('username').value : '';
            state.email = get('email') ? get('email').value : '';
            state.oldPassword = get('old-password') ? get('old-password').value : '';
            state.recoveryCode = get('recovery-code') ? get('recovery-code').value.trim().toUpperCase() : '';
            const manualToken = get('manual-token') ? get('manual-token').value.trim() : '';

            try {
                if (state.method === 'access') {
                    if (state.subMethod === 'email') {
                        await apiRequestEmail();
                    } else {
                        state.token = manualToken;
                        await apiValidateToken(manualToken);
                    }
                } else {
                    // Code or Password methods move to Reset View directly (validated there or here?)
                    // Actually, logic was: move to Reset view, then submit calls API.
                    // But for recovery code, we might want to validate first?
                    // The original code moved to Reset view immediately.
                    setupResetView();
                    switchView('view-reset');
                }
            } catch (error) {
                showAlert('danger', error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    // --- Step 3: API Calls & Reset ---

    async function apiRequestEmail() {
        const res = await fetch('/api/auth/password-reset/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: state.username, email: state.email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        
        if (data.token) { // Dev mode
            showAlert('success', '<strong>Dev Mode:</strong> Token generated: ' + data.token);
            state.token = data.token;
            // Auto-advance for convenience
            // setTimeout(() => apiValidateToken(data.token), 2000); 
        } else if (data.email_sent === false) {
            showAlert('warning', 'Account found, but email service is offline. Contact admin.');
        } else {
            showAlert('success', 'Reset link sent to your email.');
        }
    }

    async function apiValidateToken(token) {
        const res = await fetch('/api/auth/password-reset/validate-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (!data.valid) throw new Error(data.error || 'Invalid token');

        state.username = data.username;
        state.hasEncryptedData = data.has_encrypted_data;
        state.canRecoverViaEmail = data.can_recover_via_email;

        setupResetView();
        switchView('view-reset');
    }

    function setupResetView() {
        setText('title', 'Set New Password');
        setText('subtitle', `For account: ${state.username}`);
        
        let msg = '';
        if (state.method === 'access') {
            if (state.canRecoverViaEmail) msg = '<div class="alert alert-success">✅ Data will be recovered via email backup.</div>';
            else if (state.hasEncryptedData) msg = '<div class="alert alert-danger">⚠️ Warning: Data will be LOST (no backup).</div>';
            else msg = '<div class="alert alert-info">Note: No encrypted data to lose.</div>';
        } else if (state.method === 'code') {
            msg = '<div class="alert alert-success">✅ Recovery Code accepted. Data will be preserved.</div>';
        } else {
            msg = '<div class="alert alert-success">✅ Password will be securely rotated.</div>';
        }
        setHtml('reset-alert', msg);
    }

    // Final Reset Submission
    const formReset = get('reset-form');
    if (formReset) {
        formReset.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = get('new-password').value;
            const p2 = get('confirm-password').value;
            if (p1 !== p2) return showAlert('danger', 'Passwords do not match', 'reset-alert');

            const btn = get('reset-submit');
            btn.disabled = true;
            btn.textContent = 'Updating...';

            try {
                let endpoint, body;
                if (state.method === 'code') {
                    endpoint = '/api/auth/password-reset/recovery';
                    body = { username: state.username, email: state.email, recovery_code: state.recoveryCode, new_password: p1 };
                } else if (state.method === 'password') {
                    endpoint = '/api/auth/password/offline-change';
                    body = { username: state.username, email: state.email, old_password: state.oldPassword, new_password: p1 };
                } else {
                    endpoint = '/api/auth/password-reset/reset';
                    body = { token: state.token, password: p1 };
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Reset failed');

                // Success
                switchView('view-success');
                setText('title', 'Success!');
                setText('subtitle', 'Account Recovered');
                const msg = data.dek_lost ? 'Password updated, but encrypted data was lost.' : 'Password updated and data recovered!';
                setText('success-message', msg);
                hide('footer-links');

            } catch (err) {
                setHtml('reset-alert', `<div class="alert alert-danger">${err.message}</div>`);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Reset Password';
            }
        });
    }

    // Helpers
    function showAlert(type, msg, containerId = 'message-container') {
        setHtml(containerId, `<div class="alert alert-${type}">${msg}</div>`);
    }

    // Check URL token on load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
        state.method = 'access';
        state.subMethod = 'token';
        state.token = urlParams.get('token');
        apiValidateToken(state.token);
    }

    // Admin Help
    const adminLink = get('admin-help-link');
    if (adminLink) {
        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            const username = prompt('Enter your username for the administrator to review:');
            const email = prompt('Enter your registered email:');
            
            if (username && email) {
                fetch('/api/auth/request-admin-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email })
                }).then(r => r.json()).then(data => {
                    if (data.support_token) {
                        alert(
                            `✅ Request Submitted!\n\n` +
                            `Please contact your administrator and provide this verification code:\n\n` +
                            `👉 ${data.support_token}\n\n` +
                            `The administrator can use this code to generate a secure reset link for you.`
                        );
                    } else {
                        alert(data.message || 'Request submitted.');
                    }
                }).catch(err => {
                    alert('Error submitting request: ' + err.message);
                });
            }
        });
    }
});
