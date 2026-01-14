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
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <div>${message}</div>
        </div>
    `;
}

/**
 * Show error message
 */
export function showError(container, message) {
    container.innerHTML = `
        <div style="background: var(--danger-bg); color: var(--danger-color); padding: 20px; border-radius: 8px; margin: 20px;">
            <strong>Error:</strong> ${message}
        </div>
    `;
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
