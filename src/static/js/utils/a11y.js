/**
 * Accessibility Utilities
 */

/**
 * Setup ARIA labels for common elements that lack them
 */
export function setupAriaLabels() {
    // Header buttons
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn && !settingsBtn.getAttribute('aria-label')) {
        settingsBtn.setAttribute('aria-label', 'Settings');
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && !logoutBtn.getAttribute('aria-label')) {
        logoutBtn.setAttribute('aria-label', 'Logout');
    }

    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn && !feedbackBtn.getAttribute('aria-label')) {
        feedbackBtn.setAttribute('aria-label', 'Send Feedback');
    }

    // Tab buttons
    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
        if (!tab.getAttribute('role')) {
            tab.setAttribute('role', 'tab');
        }
        const tabName = tab.getAttribute('data-tab');
        if (!tab.getAttribute('aria-label')) {
            tab.setAttribute('aria-label', `Navigate to ${tabName} tab`);
        }
    });

    // Images
    document.querySelectorAll('img').forEach(img => {
        if (!img.getAttribute('alt')) {
            img.setAttribute('alt', ''); // Decorative by default if alt missing
        }
    });
}

/**
 * Focus trap for modals
 * @param {HTMLElement} element - Modal container
 */
export function trapFocus(element) {
    const focusableElements = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', function(e) {
        let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

        if (!isTabPressed) {
            return;
        }

        if (e.shiftKey) { // if shift key pressed for shift + tab
            if (document.activeElement === firstFocusableElement) {
                lastFocusableElement.focus(); // add focus for the last focusable element
                e.preventDefault();
            }
        } else { // if tab key is pressed
            if (document.activeElement === lastFocusableElement) {
                firstFocusableElement.focus(); // add focus for the first focusable element
                e.preventDefault();
            }
        }
    });
    
    if (firstFocusableElement) {
        firstFocusableElement.focus();
    }
}
