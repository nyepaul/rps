/**
 * DOM utility functions
 */

/**
 * Create element with attributes and children
 */
export function createElement(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });

    children.flat().forEach(child => {
        if (child instanceof Node) {
            element.appendChild(child);
        } else if (child !== null && child !== undefined) {
            element.appendChild(document.createTextNode(String(child)));
        }
    });

    return element;
}

/**
 * Show loading spinner
 */
export function showLoading(container, message = 'Loading...') {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner" style="
                width: 48px;
                height: 48px;
                border: 4px solid var(--border-color);
                border-top-color: var(--accent-color);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 20px;
            "></div>
            <div>${message}</div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
}

/**
 * Show error message in container
 */
export function showErrorInContainer(container, message) {
    container.innerHTML = `
        <div style="background: var(--danger-bg); color: var(--danger-color); padding: 20px; border-radius: 8px; margin: 20px;">
            <strong>Error:</strong> ${message}
        </div>
    `;
}

/**
 * Show error toast notification
 */
export function showError(message, duration = 4000) {
    const toast = createElement('div', {
        style: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'var(--danger-color, #dc3545)',
            color: 'white',
            padding: '15px 25px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: '10000',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '400px',
        },
    }, message);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show success message
 */
export function showSuccess(message, duration = 3000) {
    const toast = createElement('div', {
        style: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'var(--success-color)',
            color: 'white',
            padding: '15px 25px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: '10000',
            animation: 'slideIn 0.3s ease-out',
        },
    }, message);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Confirm dialog
 */
export function confirm(message) {
    return window.confirm(message);
}

/**
 * Clear container
 */
export function clearContainer(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

/**
 * Show global loading spinner overlay
 */
export function showSpinner(message = 'Loading...') {
    const existingSpinner = document.getElementById('global-spinner');
    if (existingSpinner) {
        return;
    }

    const spinner = document.createElement('div');
    spinner.id = 'global-spinner';
    spinner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;

    spinner.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 40px 60px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;">
            <div class="spinner" style="
                width: 60px;
                height: 60px;
                border: 4px solid var(--border-color);
                border-top-color: var(--accent-color);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 20px;
            "></div>
            <div style="font-size: 16px; color: var(--text-primary); font-weight: 500;">${message}</div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;

    document.body.appendChild(spinner);
}

/**
 * Hide global loading spinner overlay
 */
export function hideSpinner() {
    const spinner = document.getElementById('global-spinner');
    if (spinner) {
        spinner.remove();
    }
}
