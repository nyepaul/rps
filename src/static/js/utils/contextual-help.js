/**
 * Contextual Help Utility
 * Provides tooltip functionality for help icons
 */

export function setupContextualHelp(container) {
    const helpIcons = container.querySelectorAll('.help-icon');

    helpIcons.forEach(icon => {
        // Normalize icon content so templates remain visually consistent.
        if (!icon.textContent || !icon.textContent.trim()) {
            icon.textContent = '?';
        }
        if (!icon.getAttribute('aria-label')) {
            icon.setAttribute('aria-label', 'Show help');
        }
        if (!icon.getAttribute('type') && icon.tagName === 'BUTTON') {
            icon.setAttribute('type', 'button');
        }

        // Match the lightweight inline "Label ?" pattern used by analysis stat help.
        Object.assign(icon.style, {
            display: 'inline',
            width: 'auto',
            height: 'auto',
            borderRadius: '0',
            background: 'none',
            border: 'none',
            color: 'var(--accent-color)',
            fontWeight: 'bold',
            fontSize: 'inherit',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '0',
            marginLeft: '5px',
            verticalAlign: 'baseline'
        });

        icon.addEventListener('mouseenter', showTooltip);
        icon.addEventListener('mouseleave', hideTooltip);
        icon.addEventListener('focus', showTooltip);
        icon.addEventListener('blur', hideTooltip);
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            // Toggle on click for mobile
            if (icon._tooltipVisible) {
                hideTooltip.call(icon);
            } else {
                showTooltip.call(icon);
            }
        });
        icon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (icon._tooltipVisible) {
                    hideTooltip.call(icon);
                } else {
                    showTooltip.call(icon);
                }
            }
        });
    });
}

function showTooltip(e) {
    const icon = this;
    const text = icon.getAttribute('data-tooltip');
    if (!text) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'context-tooltip';
    tooltip.textContent = text;
    
    // Style it
    Object.assign(tooltip.style, {
        position: 'absolute',
        background: 'rgba(33, 37, 41, 0.95)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        maxWidth: '250px',
        zIndex: '10000',
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        lineHeight: '1.4',
        opacity: '0',
        transition: 'opacity 0.2s',
        textAlign: 'left'
    });

    document.body.appendChild(tooltip);
    icon._tooltipElement = tooltip;
    icon._tooltipVisible = true;

    // Position it
    const rect = icon.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect(); // Get dimensions before showing
    
    // Default position: Top center
    let top = rect.top - tooltip.offsetHeight - 10 + window.scrollY;
    let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + window.scrollX;

    // Check bounds
    if (left < 10) left = 10;
    if (left + tooltip.offsetWidth > window.innerWidth - 10) {
        left = window.innerWidth - 10 - tooltip.offsetWidth;
    }
    
    // Flip to bottom if not enough space on top
    if (rect.top < tooltip.offsetHeight + 20) {
        top = rect.bottom + 10 + window.scrollY;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Trigger fade in
    requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
    });
}

function hideTooltip() {
    const icon = this;
    if (icon._tooltipElement) {
        icon._tooltipElement.remove();
        icon._tooltipElement = null;
        icon._tooltipVisible = false;
    }
}
