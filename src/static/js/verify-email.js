document.addEventListener('DOMContentLoaded', async () => {
    const messageDiv = document.getElementById('message');
    const spinner = document.getElementById('spinner');
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        messageDiv.innerHTML = '<div class="error">Invalid or missing verification token.</div>';
        spinner.classList.remove('active');
        return;
    }

    try {
        const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: 'Server returned an invalid response.' };
        }

        if (response.ok) {
            messageDiv.innerHTML = `<div class="success">${data.message || 'Email verified successfully!'}</div>`;
            setTimeout(() => window.location.href = '/login', 3000);
        } else {
            messageDiv.innerHTML = `<div class="error">${data.error || 'Verification failed. The link may be expired or invalid.'}</div>`;
        }
    } catch (error) {
        console.error('Verification error:', error);
        messageDiv.innerHTML = '<div class="error">Network error. Please try again later.</div>';
    } finally {
        spinner.classList.remove('active');
    }
});
