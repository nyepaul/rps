document.addEventListener('DOMContentLoaded', async () => {
    const messageDiv = document.getElementById('message');
    const spinner = document.getElementById('spinner');

    const setMessage = (kind, message) => {
        if (!messageDiv) return;
        messageDiv.replaceChildren();
        const node = document.createElement('div');
        node.className = kind;
        node.textContent = message;
        messageDiv.appendChild(node);
    };
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        setMessage('error', 'Invalid or missing verification token.');
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
            setMessage('success', data.message || 'Email verified successfully!');
            setTimeout(() => window.location.href = '/login', 3000);
        } else {
            setMessage('error', data.error || 'Verification failed. The link may be expired or invalid.');
        }
    } catch (error) {
        console.error('Verification error:', error);
        setMessage('error', 'Network error. Please try again later.');
    } finally {
        spinner.classList.remove('active');
    }
});
