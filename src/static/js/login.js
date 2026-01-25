document.addEventListener('DOMContentLoaded', () => {
    // Explicitly set site identifier for password managers
    window.location.hostname; // Force evaluation of full hostname

    const API_URL = '/api';
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const toggleLink = document.getElementById('toggleLink');
    const toggleText = document.getElementById('toggleText');
    const backToLoginLink = document.getElementById('backToLoginLink');
    const messageDiv = document.getElementById('message');
    let currentMode = 'login'; // 'login', 'register', 'resetRequest', 'resetPassword'
    let resetToken = null;
    
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

        // Show appropriate form
        if (mode === 'login') {
            loginForm.classList.remove('hidden');
            toggleText.textContent = "Don't have an account? ";
            toggleLink.textContent = "Register";
            backToLoginLink.classList.add('hidden');
            document.querySelector('h1').textContent = "Welcome Back";
        } else if (mode === 'register') {
            registerForm.classList.remove('hidden');
            toggleText.textContent = "Already have an account? ";
            toggleLink.textContent = "Login";
            backToLoginLink.classList.add('hidden');
            document.querySelector('h1').textContent = "Create Account";
        } else if (mode === 'resetRequest') {
            resetRequestForm.classList.remove('hidden');
            toggleText.textContent = "";
            toggleLink.classList.add('hidden');
            backToLoginLink.classList.remove('hidden');
            document.querySelector('h1').textContent = "Reset Password";
        } else if (mode === 'resetPassword') {
            resetPasswordForm.classList.remove('hidden');
            toggleText.textContent = "";
            toggleLink.classList.add('hidden');
            backToLoginLink.classList.remove('hidden');
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
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => window.location.href = '/', 1000);
                } else {
                    showMessage(data.error || 'Login failed', 'error');
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

                const data = await response.json();

                if (response.ok) {
                    spinner.querySelector('.spinner-text').textContent = 'Registration successful! Redirecting...';
                    showMessage('Registration successful! Redirecting...', 'success');
                    setTimeout(() => window.location.href = '/', 1000);
                } else {
                    showMessage(data.error || 'Registration failed', 'error');
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

    // Check if already logged in
    fetch(`${API_URL}/auth/session`)
        .then(res => res.json())
        .then(data => {
            if (data.authenticated) {
                window.location.href = '/';
            }
        })
        .catch(() => {});
});
