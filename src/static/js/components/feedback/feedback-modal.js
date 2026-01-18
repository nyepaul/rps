/**
 * Feedback Modal Component
 * Allows users to submit comments, feature requests, and bug reports
 */

/**
 * Collect comprehensive browser and system information
 */
function collectBrowserInfo() {
    return {
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || navigator.userLanguage,
        current_url: window.location.href,
        color_depth: window.screen.colorDepth,
        pixel_ratio: window.devicePixelRatio,
        platform: navigator.platform,
        online: navigator.onLine,
        cookie_enabled: navigator.cookieEnabled,
        do_not_track: navigator.doNotTrack
    };
}

/**
 * Collect additional system information
 */
function collectSystemInfo() {
    const info = {
        user_agent: navigator.userAgent,
        vendor: navigator.vendor,
        app_name: navigator.appName,
        app_version: navigator.appVersion
    };

    // Memory info (if available)
    if (navigator.deviceMemory) {
        info.device_memory_gb = navigator.deviceMemory;
    }

    // Connection info (if available)
    if (navigator.connection) {
        info.connection_type = navigator.connection.effectiveType;
        info.connection_downlink = navigator.connection.downlink;
        info.connection_rtt = navigator.connection.rtt;
    }

    // Hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency) {
        info.cpu_cores = navigator.hardwareConcurrency;
    }

    return info;
}

/**
 * Submit feedback to the server
 */
async function submitFeedback(type, content) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: JSON.stringify({
            type,
            content,
            browser_info: collectBrowserInfo(),
            system_info: collectSystemInfo()
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit feedback');
    }

    return await response.json();
}

/**
 * Show success message
 */
function showSuccessMessage(container) {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h3 style="color: var(--success-color); margin: 0 0 12px 0;">Thank You!</h3>
            <p style="color: var(--text-secondary); margin: 0;">
                Your feedback has been submitted successfully. We appreciate your input!
            </p>
        </div>
    `;

    setTimeout(() => {
        const modal = document.getElementById('feedback-modal');
        if (modal) modal.remove();
    }, 2000);
}

/**
 * Show error message
 */
function showError(container, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: var(--danger-bg);
        color: var(--danger-color);
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 16px;
        border-left: 4px solid var(--danger-color);
    `;
    errorDiv.textContent = message;

    const existingError = container.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    container.insertBefore(errorDiv, container.firstChild);
}

/**
 * Render feedback modal
 */
export function renderFeedbackModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'feedback-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    `;

    content.innerHTML = `
        <div style="padding: 24px; border-bottom: 2px solid var(--border-color); background: linear-gradient(135deg, #1098ad, #15aabf); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">
                        💬 Send Feedback
                    </h2>
                    <p style="margin: 0; font-size: 14px; opacity: 0.95;">
                        Help us improve by sharing your thoughts, ideas, or issues
                    </p>
                </div>
                <button id="close-feedback-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                    ×
                </button>
            </div>
        </div>

        <div id="feedback-form-container" style="padding: 24px;">
            <form id="feedback-form">
                <!-- Type Selection -->
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                        What would you like to share?
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <label class="feedback-type-option" style="cursor: pointer;">
                            <input type="radio" name="feedback-type" value="comment" required style="display: none;">
                            <div class="type-card" data-type="comment" style="
                                padding: 16px;
                                border: 2px solid var(--border-color);
                                border-radius: 8px;
                                text-align: center;
                                transition: all 0.2s;
                                background: var(--bg-tertiary);
                            ">
                                <div style="font-size: 32px; margin-bottom: 8px;">💭</div>
                                <div style="font-weight: 600; font-size: 14px;">Comment</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">General feedback</div>
                            </div>
                        </label>

                        <label class="feedback-type-option" style="cursor: pointer;">
                            <input type="radio" name="feedback-type" value="feature" required style="display: none;">
                            <div class="type-card" data-type="feature" style="
                                padding: 16px;
                                border: 2px solid var(--border-color);
                                border-radius: 8px;
                                text-align: center;
                                transition: all 0.2s;
                                background: var(--bg-tertiary);
                            ">
                                <div style="font-size: 32px; margin-bottom: 8px;">💡</div>
                                <div style="font-weight: 600; font-size: 14px;">Feature</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Request new feature</div>
                            </div>
                        </label>

                        <label class="feedback-type-option" style="cursor: pointer;">
                            <input type="radio" name="feedback-type" value="bug" required style="display: none;">
                            <div class="type-card" data-type="bug" style="
                                padding: 16px;
                                border: 2px solid var(--border-color);
                                border-radius: 8px;
                                text-align: center;
                                transition: all 0.2s;
                                background: var(--bg-tertiary);
                            ">
                                <div style="font-size: 32px; margin-bottom: 8px;">🐛</div>
                                <div style="font-weight: 600; font-size: 14px;">Bug</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Report an issue</div>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Content -->
                <div style="margin-bottom: 20px;">
                    <label for="feedback-content" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                        Details
                    </label>
                    <textarea
                        id="feedback-content"
                        name="content"
                        required
                        placeholder="Please provide as much detail as possible..."
                        style="
                            width: 100%;
                            min-height: 150px;
                            padding: 12px;
                            border: 2px solid var(--border-color);
                            border-radius: 8px;
                            font-family: inherit;
                            font-size: 14px;
                            resize: vertical;
                            background: var(--bg-tertiary);
                            color: var(--text-primary);
                        "
                    ></textarea>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        Maximum 10,000 characters
                    </div>
                </div>

                <!-- Buttons -->
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button type="button" id="cancel-feedback" style="
                        padding: 10px 20px;
                        background: var(--bg-tertiary);
                        border: 2px solid var(--border-color);
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        color: var(--text-primary);
                        transition: all 0.2s;
                    ">
                        Cancel
                    </button>
                    <button type="submit" id="submit-feedback" style="
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #1098ad, #15aabf);
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        color: white;
                        transition: all 0.2s;
                    ">
                        Submit Feedback
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.appendChild(content);

    // Add event listeners for type selection
    const typeCards = content.querySelectorAll('.type-card');
    const typeInputs = content.querySelectorAll('input[name="feedback-type"]');

    typeInputs.forEach((input, index) => {
        input.addEventListener('change', () => {
            typeCards.forEach(card => {
                card.style.borderColor = 'var(--border-color)';
                card.style.background = 'var(--bg-tertiary)';
            });
            if (input.checked) {
                typeCards[index].style.borderColor = '#1098ad';
                typeCards[index].style.background = 'rgba(16, 152, 173, 0.1)';
            }
        });
    });

    // Click on card selects the radio
    typeCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            typeInputs[index].checked = true;
            typeInputs[index].dispatchEvent(new Event('change'));
        });
    });

    // Form submission
    const form = content.querySelector('#feedback-form');
    const submitBtn = content.querySelector('#submit-feedback');
    const formContainer = content.querySelector('#feedback-form-container');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = form.querySelector('input[name="feedback-type"]:checked')?.value;
        const contentText = form.querySelector('#feedback-content').value.trim();

        if (!type) {
            showError(formContainer, 'Please select a feedback type');
            return;
        }

        if (!contentText) {
            showError(formContainer, 'Please provide feedback details');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            await submitFeedback(type, contentText);
            showSuccessMessage(formContainer);
        } catch (error) {
            showError(formContainer, error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
        }
    });

    // Close button
    const closeBtn = content.querySelector('#close-feedback-modal');
    closeBtn.addEventListener('click', () => modal.remove());

    // Cancel button
    const cancelBtn = content.querySelector('#cancel-feedback');
    cancelBtn.addEventListener('click', () => modal.remove());

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    return modal;
}

/**
 * Show feedback modal
 */
export function showFeedbackModal() {
    // Remove existing modal if any
    const existing = document.getElementById('feedback-modal');
    if (existing) {
        existing.remove();
    }

    const modal = renderFeedbackModal();
    document.body.appendChild(modal);
}
