import { apiClient } from './api/client.js';
import { API_ENDPOINTS } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Explicitly set site identifier for password managers
    window.location.hostname; // Force evaluation of full hostname

    const API_URL = '/api';
    // ... rest of selectors
    
    // Toggle between login and register
    if (toggleLink) {
        toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentMode === 'login') {
                showMode('register');
            } else {
                showMode('login');
            }
        });
    }

    // Resend Toggle
    if (resendToggle) {
        resendToggle.addEventListener('click', (e) => {
            e.preventDefault();
            showMode('resend');
        });
    }

    // Back to login link
    const backToLogin = document.getElementById('backToLogin');
    if (backToLogin) {
        backToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showMode('login');
        });
    }

    function showMode(mode) {
        currentMode = mode;
        clearMessage();

        // Hide all forms
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        resetRequestForm.classList.add('hidden');
        resetPasswordForm.classList.add('hidden');
        if (resendVerificationForm) resendVerificationForm.classList.add('hidden');

        // Show appropriate form
        if (mode === 'login') {
            loginForm.classList.remove('hidden');
            toggleText.textContent = "Don't have an account? ";
            toggleLink.textContent = "Register";
            toggleLink.classList.remove('hidden');
            backToLoginLink.classList.add('hidden');
            if (resendLinkContainer) resendLinkContainer.classList.remove('hidden');
            document.querySelector('h1').textContent = "Welcome Back";
        } else if (mode === 'register') {
            registerForm.classList.remove('hidden');
            toggleText.textContent = "Already have an account? ";
            toggleLink.textContent = "Login";
            toggleLink.classList.remove('hidden');
            backToLoginLink.classList.add('hidden');
            if (resendLinkContainer) resendLinkContainer.classList.add('hidden');
            document.querySelector('h1').textContent = "Create Account";
        } else if (mode === 'resend') {
            if (resendVerificationForm) resendVerificationForm.classList.remove('hidden');
            toggleText.textContent = "Back to ";
            toggleLink.textContent = "Login";
            toggleLink.classList.remove('hidden');
            backToLoginLink.classList.add('hidden');
            if (resendLinkContainer) resendLinkContainer.classList.add('hidden');
            document.querySelector('h1').textContent = "Resend Verification";
        } else if (mode === 'resetRequest') {
            resetRequestForm.classList.remove('hidden');
            toggleText.textContent = "";
            toggleLink.classList.add('hidden');
            backToLoginLink.classList.remove('hidden');
            if (resendLinkContainer) resendLinkContainer.classList.add('hidden');
            document.querySelector('h1').textContent = "Reset Password";
        } else if (mode === 'resetPassword') {
            resetPasswordForm.classList.remove('hidden');
            toggleText.textContent = "";
            toggleLink.classList.add('hidden');
            backToLoginLink.classList.remove('hidden');
            if (resendLinkContainer) resendLinkContainer.classList.add('hidden');
            document.querySelector('h1').textContent = "Set New Password";
        }
    }
    
    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const btn = document.getElementById('loginBtn');
            const spinner = document.getElementById('loginSpinner');

            btn.disabled = true;
            btn.style.opacity = '0.6';
            spinner.classList.add('active');

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    spinner.querySelector('.spinner-text').textContent = 'Login successful! Redirecting...';
                    
                    // Check if we need to show recovery code
                    if (data.show_recovery_code) {
                        const modal = document.getElementById('recoveryModal');
                        const codeSpan = document.getElementById('recoveryCodeText');
                        const closeBtn = document.getElementById('closeRecoveryModal');
                        
                        codeSpan.textContent = data.show_recovery_code;
                        modal.classList.add('active');
                        
                        closeBtn.onclick = () => {
                            modal.classList.remove('active');
                            window.location.href = '/';
                        };
                    } else {
                        showMessage('Login successful! Redirecting...', 'success');
                        setTimeout(() => window.location.href = '/', 1000);
                    }
                } else {
                    showMessage(data.error || 'Login failed', 'error');
                    // If email not verified, show resend option clearly
                    if (data.code === 'EMAIL_NOT_VERIFIED') {
                        const extra = document.createElement('div');
                        extra.style.marginTop = '10px';
                        extra.innerHTML = '<a href="#" id="resendFromError" style="color: #667eea; font-weight: bold;">Click here to resend verification email</a>';
                        messageDiv.appendChild(extra);
                        document.getElementById('resendFromError').onclick = (e) => {
                            e.preventDefault();
                            showMode('resend');
                        };
                    }
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                if (!document.querySelector('.success')) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    spinner.classList.remove('active');
                }
            }
        });
    }
    
    // Register
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const btn = document.getElementById('registerBtn');
            const spinner = document.getElementById('registerSpinner');

            btn.disabled = true;
            btn.style.opacity = '0.6';
            spinner.classList.add('active');

            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                let data;
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                }

                if (response.ok) {
                    const successMsg = data?.message || 'Registration successful! Please check your email to verify your account.';
                    showMessage(successMsg, 'success');
                    spinner.classList.remove('active');
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    
                    // If in development mode and token is provided, show auto-verify option
                    if (data?.development_mode && data?.verification_token) {
                        const devDiv = document.createElement('div');
                        devDiv.style.marginTop = '15px';
                        devDiv.style.padding = '10px';
                        devDiv.style.background = '#fef3c7';
                        devDiv.style.border = '1px solid #f59e0b';
                        devDiv.style.borderRadius = '4px';
                        devDiv.innerHTML = `
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #92400e;"><strong>Dev Mode:</strong> Email sending might be disabled.</p>
                            <button id="autoVerifyBtn" style="background: #f59e0b; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Verify Account Now (Local Only)</button>
                        `;
                        messageDiv.appendChild(devDiv);
                        
                        document.getElementById('autoVerifyBtn').onclick = async (e) => {
                            e.preventDefault();
                            try {
                                const vResp = await fetch(`${API_URL}/auth/verify-email`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ token: data.verification_token })
                                });
                                const vData = await vResp.json();
                                if (vResp.ok) {
                                    showMessage('Account verified! You can now log in.', 'success');
                                    setTimeout(() => showMode('login'), 2000);
                                } else {
                                    showMessage(vData.error || 'Verification failed', 'error');
                                }
                            } catch (err) {
                                showMessage('Auto-verification failed', 'error');
                            }
                        };
                    }
                    
                    // Clear form
                    registerForm.reset();
                    
                    // Switch to login mode after a delay so they can see the message
                    setTimeout(() => {
                        if (currentMode === 'register') {
                            showMode('login');
                        }
                    }, 8000);
                } else {
                    if (response.status === 429) {
                        showMessage('Too many registration attempts. Please wait a few minutes and try again.', 'error');
                    } else {
                        showMessage(data?.error || 'Registration failed. Please try again.', 'error');
                    }
                }
            } catch (error) {
                console.error('Registration error:', error);
                showMessage('Network error or server unavailable. Please try again.', 'error');
            } finally {
                if (!document.querySelector('.success')) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    spinner.classList.remove('active');
                }
            }
        });
    }

    // Resend Verification
    if (resendVerificationForm) {
        resendVerificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const email = document.getElementById('resendEmail').value;
            const btn = document.getElementById('resendBtn');

            btn.disabled = true;
            btn.textContent = 'Sending...';

            try {
                const response = await fetch(`${API_URL}/auth/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(data.message || 'Verification email sent. Please check your inbox.', 'success');
                    setTimeout(() => showMode('login'), 3000);
                } else {
                    const errorMsg = data.error || 'We couldn\'t resend the verification link. Please check your email address and try again.';
                    showMessage(errorMsg, 'error');
                    
                    // If already verified, give them a shortcut back to login
                    if (data.code === 'ALREADY_VERIFIED') {
                        const extra = document.createElement('div');
                        extra.style.marginTop = '15px';
                        extra.innerHTML = '<button onclick="window.app.showLoginMode()" style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Go to Login</button>';
                        messageDiv.appendChild(extra);
                    }
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Verification Link';
            }
        });
    }
    
    // Password Reset Request
    if (resetRequestForm) {
        resetRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const username = document.getElementById('resetUsername').value;
            const email = document.getElementById('resetEmail').value;
            const btn = document.getElementById('resetRequestBtn');

            btn.disabled = true;
            btn.textContent = 'Sending...';

            try {
                const response = await fetch(`${API_URL}/auth/password-reset/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email })
                });

                const data = await response.json();

                if (response.ok) {
                    if (data.development_mode && data.token) {
                        // Development mode - show token
                        resetToken = data.token;
                        showMessage(`Reset token: <strong>${data.token}</strong><br>Token expires in 1 hour. Click "Continue" to reset your password.`, 'success');
                        btn.textContent = 'Continue';
                        btn.onclick = (e) => {
                            e.preventDefault();
                            showMode('resetPassword');
                        };
                    } else {
                        showMessage(data.message || 'Reset link sent to your email.', 'success');
                    }
                } else {
                    showMessage(data.error || 'Failed to send reset link', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                if (!resetToken) {
                    btn.disabled = false;
                    btn.textContent = 'Send Reset Link';
                }
            }
        });
    }

    // Password Reset
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const btn = document.getElementById('resetPasswordBtn');

            // Validate passwords match
            if (newPassword !== confirmPassword) {
                showMessage('Passwords do not match', 'error');
                return;
            }

            // Get token from URL or from development mode
            const urlParams = new URLSearchParams(window.location.search);
            const token = resetToken || urlParams.get('token');

            if (!token) {
                showMessage('Invalid or missing reset token', 'error');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Resetting password...';

            try {
                const response = await fetch(`${API_URL}/auth/password-reset/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password: newPassword })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(data.message || 'Password reset successful! Redirecting to login...', 'success');
                    setTimeout(() => {
                        resetToken = null;
                        showMode('login');
                        document.getElementById('resetPasswordForm').reset();
                    }, 2000);
                } else {
                    showMessage(data.error || 'Password reset failed', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Reset Password';
            }
        });
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.innerHTML = `<div class="${type}">${text}</div>`;
        }
    }

    function clearMessage() {
        if (messageDiv) {
            messageDiv.innerHTML = '';
        }
    }

    // Check for reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
        showMode('resetPassword');
    }

    // Check if already logged in using standardized client
    async function checkExistingSession() {
        try {
            const data = await apiClient.get(API_ENDPOINTS.AUTH_SESSION);
            if (data.authenticated) {
                window.location.href = '/';
            }
        } catch (error) {
            // Silently ignore auth check failures on login page
            console.debug('No active session found');
        }
    }
    
    checkExistingSession();

    // Load version info
    fetch('/version.json')
        .then(res => res.json())
        .then(data => {
            const badge = document.querySelector('.version-badge');
            if (badge) {
                badge.textContent = `System Version: v${data.version}`;
                badge.title = `Release Date: ${data.release_date}\nNotes: ${data.release_notes}`;
            }
        })
        .catch(() => {});

    // Expose helpers for dynamic HTML
    window.app = {
        showLoginMode: () => showMode('login')
    };
});
