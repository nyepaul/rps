/**
 * Client-side activity tracking module.
 * Tracks user interactions (clicks, navigation, etc.) and sends them to the server.
 *
 * Events are batched and sent periodically to minimize network overhead.
 *
 * GRANULAR CLICK TRACKING FEATURES:
 * - ALL mouse clicks tracked (not just interactive elements)
 * - Detailed click context: DOM path, coordinates, modifiers (shift/ctrl/alt/meta)
 * - Right-click (context menu) tracking
 * - Double-click tracking
 * - Hover tracking (debounced, for important elements only)
 * - Mouse movement path tracking (sampled, for heatmaps)
 *
 * Configuration options:
 *   trackAllClicks: true (default) - Track all clicks with full detail
 *   trackRightClicks: true (default) - Track right-click/context menu
 *   trackDoubleClicks: true (default) - Track double-clicks
 *   trackHover: false (default) - Track hover events (high volume)
 *   trackMousePath: false (default) - Track mouse movement (very high volume)
 *   batchSize: 10 - Number of events to batch before sending
 *   flushInterval: 5000 - Milliseconds between automatic flushes
 *
 * Each click captures:
 *   - Element details (tag, id, class, text)
 *   - Position (x, y coordinates, viewport size)
 *   - Keyboard modifiers (shift, ctrl, alt, meta keys)
 *   - DOM path (CSS selector chain to the element)
 *   - Interactive element detection
 *   - Data attributes (for custom tracking)
 *
 * Example usage:
 *   const tracker = new ActivityTracker({
 *     trackAllClicks: true,
 *     trackRightClicks: true,
 *     trackHover: true,
 *     hoverDebounceTime: 2000
 *   });
 */

class ActivityTracker {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.batchSize = options.batchSize || 10;
        this.flushInterval = options.flushInterval || 5000; // 5 seconds
        this.eventQueue = [];
        this.sessionStartTime = Date.now();
        this.lastActivityTime = Date.now();
        this.idleThreshold = options.idleThreshold || 300000; // 5 minutes
        this.isIdle = false;
        this.currentPage = '';

        // Granular click tracking options
        this.trackAllClicks = options.trackAllClicks !== false; // Track ALL clicks, not just interactive elements
        this.trackRightClicks = options.trackRightClicks !== false;
        this.trackDoubleClicks = options.trackDoubleClicks !== false;
        this.trackHover = options.trackHover === true; // Disabled by default (high volume)
        this.hoverDebounceTime = options.hoverDebounceTime || 1000;
        this.trackMousePath = options.trackMousePath === true; // Disabled by default (very high volume)
        this.mousePathSampleRate = options.mousePathSampleRate || 500; // ms between samples

        this.lastHoverTarget = null;
        this.hoverTimer = null;
        this.lastMousePathSample = 0;

        if (this.enabled) {
            this.init();
        }
    }

    init() {
        // Start batch flush timer
        this.flushTimer = setInterval(() => this.flush(), this.flushInterval);

        // Track all mouse clicks (granular tracking)
        if (this.trackAllClicks) {
            document.addEventListener('click', (e) => this.handleClick(e), true);
        }

        // Track right-clicks (context menu)
        if (this.trackRightClicks) {
            document.addEventListener('contextmenu', (e) => this.handleRightClick(e), true);
        }

        // Track double-clicks
        if (this.trackDoubleClicks) {
            document.addEventListener('dblclick', (e) => this.handleDoubleClick(e), true);
        }

        // Track hover events (debounced)
        if (this.trackHover) {
            document.addEventListener('mouseover', (e) => this.handleMouseOver(e), true);
        }

        // Track mouse path for heatmapping (sampled)
        if (this.trackMousePath) {
            document.addEventListener('mousemove', (e) => this.handleMouseMove(e), { passive: true });
        }

        // Track page visibility changes
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

        // Track before unload (session end)
        window.addEventListener('beforeunload', () => this.handleUnload());

        // Track idle state
        this.idleTimer = null;
        this.resetIdleTimer();
        ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => this.resetIdleTimer(), { passive: true });
        });

        // Track errors
        window.addEventListener('error', (e) => this.handleError(e));
        window.addEventListener('unhandledrejection', (e) => this.handlePromiseRejection(e));

        // Log session start
        this.logSessionEvent('start');
    }

    /**
     * Handle ALL click events with granular detail.
     */
    handleClick(e) {
        const target = e.target;
        const interactiveElement = target.closest('button, a, [role="button"], [role="tab"], .clickable, .btn, [onclick], [data-action], input, select, textarea, [contenteditable]');

        // Build comprehensive click data
        const clickData = {
            // Target element details
            tag: target.tagName?.toLowerCase() || '',
            element_id: target.id || '',
            element_text: this.getElementText(target),
            element_class: typeof target.className === 'string' ? target.className : target.className?.toString() || '',

            // Position and viewport
            x: e.clientX,
            y: e.clientY,
            page_x: e.pageX,
            page_y: e.pageY,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,

            // Modifiers
            shift_key: e.shiftKey,
            ctrl_key: e.ctrlKey,
            alt_key: e.altKey,
            meta_key: e.metaKey,

            // Button clicked (0=left, 1=middle, 2=right)
            button: e.button,

            // Page context
            page: this.currentPage,
            url: window.location.href,

            // DOM path for precise tracking
            dom_path: this.getDOMPath(target),

            // Interactive element (if applicable)
            is_interactive: !!interactiveElement
        };

        // Add interactive element specific data
        if (interactiveElement) {
            clickData.interactive_type = this.getElementType(interactiveElement);
            clickData.interactive_id = interactiveElement.id || interactiveElement.dataset.id || '';
            clickData.interactive_text = this.getElementText(interactiveElement);
            clickData.target_url = interactiveElement.href || interactiveElement.dataset.href || '';
            clickData.data_action = interactiveElement.dataset.action || '';
        }

        // Add data attributes (useful for custom tracking)
        const dataAttrs = this.getDataAttributes(target);
        if (Object.keys(dataAttrs).length > 0) {
            clickData.data_attrs = dataAttrs;
        }

        this.queueEvent('click', clickData);
    }

    /**
     * Handle right-click (context menu) events.
     */
    handleRightClick(e) {
        const target = e.target;

        this.queueEvent('rightclick', {
            tag: target.tagName?.toLowerCase() || '',
            element_id: target.id || '',
            element_text: this.getElementText(target),
            element_class: typeof target.className === 'string' ? target.className : '',
            x: e.clientX,
            y: e.clientY,
            page: this.currentPage,
            dom_path: this.getDOMPath(target)
        });
    }

    /**
     * Handle double-click events.
     */
    handleDoubleClick(e) {
        const target = e.target;

        this.queueEvent('dblclick', {
            tag: target.tagName?.toLowerCase() || '',
            element_id: target.id || '',
            element_text: this.getElementText(target),
            x: e.clientX,
            y: e.clientY,
            page: this.currentPage,
            dom_path: this.getDOMPath(target)
        });
    }

    /**
     * Handle hover events (debounced to avoid spam).
     */
    handleMouseOver(e) {
        const target = e.target;

        // Skip if hovering over the same element
        if (this.lastHoverTarget === target) return;

        this.lastHoverTarget = target;

        // Clear existing timer
        clearTimeout(this.hoverTimer);

        // Debounce: only log if hover persists
        this.hoverTimer = setTimeout(() => {
            // Check if element is still interactive/important
            const isImportant = target.tagName && (
                ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
                target.hasAttribute('role') ||
                target.classList.contains('btn') ||
                target.classList.contains('clickable')
            );

            if (isImportant) {
                this.queueEvent('hover', {
                    tag: target.tagName?.toLowerCase() || '',
                    element_id: target.id || '',
                    element_text: this.getElementText(target),
                    x: e.clientX,
                    y: e.clientY,
                    page: this.currentPage
                });
            }
        }, this.hoverDebounceTime);
    }

    /**
     * Handle mouse movement for path/heatmap tracking (sampled).
     */
    handleMouseMove(e) {
        const now = Date.now();

        // Sample at specified rate to avoid overwhelming the system
        if (now - this.lastMousePathSample < this.mousePathSampleRate) {
            return;
        }

        this.lastMousePathSample = now;

        this.queueEvent('mousemove', {
            x: e.clientX,
            y: e.clientY,
            page_x: e.pageX,
            page_y: e.pageY,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            page: this.currentPage
        });
    }

    /**
     * Determine the type of element clicked.
     */
    getElementType(element) {
        const tag = element.tagName.toLowerCase();

        if (tag === 'button' || element.role === 'button') return 'button';
        if (tag === 'a') return 'link';
        if (element.role === 'tab') return 'tab';
        if (element.classList.contains('nav-item')) return 'nav';
        if (element.classList.contains('dropdown-item')) return 'dropdown-item';
        if (element.classList.contains('modal')) return 'modal';
        if (element.dataset.action) return element.dataset.action;

        return tag;
    }

    /**
     * Get sanitized text content from an element.
     */
    getElementText(element) {
        // Try to get meaningful text
        const text = element.textContent || element.innerText || element.title || element.ariaLabel || '';
        // Truncate and clean
        return text.trim().substring(0, 50).replace(/\s+/g, ' ');
    }

    /**
     * Get the DOM path to an element (for precise identification).
     * Returns a CSS selector path like: body > div#app > main.content > button.btn
     */
    getDOMPath(element) {
        if (!element || !element.tagName) return '';

        const path = [];
        let current = element;
        let depth = 0;
        const maxDepth = 10; // Limit depth to avoid huge strings

        while (current && current.tagName && depth < maxDepth) {
            let selector = current.tagName.toLowerCase();

            // Add ID if present (makes path more specific)
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break; // ID is unique, we can stop here
            }

            // Add first class (if present)
            if (current.className && typeof current.className === 'string') {
                const firstClass = current.className.split(' ')[0];
                if (firstClass) {
                    selector += `.${firstClass}`;
                }
            }

            path.unshift(selector);

            current = current.parentElement;
            depth++;
        }

        return path.join(' > ');
    }

    /**
     * Extract data-* attributes from an element (useful for custom tracking).
     */
    getDataAttributes(element) {
        const dataAttrs = {};
        if (!element || !element.dataset) return dataAttrs;

        // Limit to first 5 data attributes to avoid huge payloads
        let count = 0;
        for (const [key, value] of Object.entries(element.dataset)) {
            if (count >= 5) break;

            // Skip internal tracking attributes
            if (key.startsWith('track') || key.startsWith('analytics')) {
                continue;
            }

            dataAttrs[key] = String(value).substring(0, 50);
            count++;
        }

        return dataAttrs;
    }

    /**
     * Track tab/page navigation.
     */
    trackPageView(pageName, profileName = null) {
        const previousPage = this.currentPage;
        this.currentPage = pageName;

        this.sendImmediately('/api/events/page-view', {
            page: pageName,
            profile_name: profileName,
            referrer: previousPage,
            timestamp: Date.now()
        });
    }

    /**
     * Track tab switches within the app.
     */
    trackTabSwitch(tabName, profileName = null) {
        this.queueEvent('tab_switch', {
            tab: tabName,
            profile_name: profileName,
            page: this.currentPage
        });
    }

    /**
     * Track modal open/close.
     */
    trackModal(modalId, action) {
        this.queueEvent(action === 'open' ? 'modal_open' : 'modal_close', {
            modal_id: modalId,
            page: this.currentPage
        });
    }

    /**
     * Track form submissions.
     */
    trackFormSubmit(formId, formName) {
        this.queueEvent('form_submit', {
            form_id: formId,
            form_name: formName,
            page: this.currentPage
        });
    }

    /**
     * Track search actions.
     */
    trackSearch(searchTerm, resultCount) {
        this.queueEvent('search', {
            search_term: searchTerm ? searchTerm.substring(0, 50) : '',
            result_count: resultCount,
            page: this.currentPage
        });
    }

    /**
     * Track filter/sort actions.
     */
    trackFilter(filterType, filterValue) {
        this.queueEvent('filter', {
            filter_type: filterType,
            filter_value: filterValue,
            page: this.currentPage
        });
    }

    /**
     * Track expand/collapse actions.
     */
    trackExpandCollapse(sectionId, isExpanded) {
        this.queueEvent(isExpanded ? 'expand' : 'collapse', {
            section_id: sectionId,
            page: this.currentPage
        });
    }

    /**
     * Track download actions.
     */
    trackDownload(filename, fileType) {
        this.queueEvent('download', {
            filename: filename,
            file_type: fileType,
            page: this.currentPage
        });
    }

    /**
     * Handle visibility change (tab switch away/back).
     */
    handleVisibilityChange() {
        if (document.hidden) {
            this.logSessionEvent('visibility_hidden');
        } else {
            this.logSessionEvent('visibility_visible');
            this.resetIdleTimer();
        }
    }

    /**
     * Handle page unload (session end).
     */
    handleUnload() {
        const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);

        // Use sendBeacon for reliable delivery
        const data = {
            event: 'end',
            duration: duration,
            timestamp: Date.now()
        };

        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/events/session', JSON.stringify(data));
        }
    }

    /**
     * Reset the idle timer.
     */
    resetIdleTimer() {
        this.lastActivityTime = Date.now();

        if (this.isIdle) {
            this.isIdle = false;
            this.logSessionEvent('resume');
        }

        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.isIdle = true;
            this.logSessionEvent('idle', { idle_time: this.idleThreshold / 1000 });
        }, this.idleThreshold);
    }

    /**
     * Handle JavaScript errors.
     */
    handleError(e) {
        this.sendImmediately('/api/events/error', {
            message: e.message,
            source: e.filename,
            line: e.lineno,
            column: e.colno,
            stack: e.error?.stack?.substring(0, 1000) || '',
            page: this.currentPage,
            timestamp: Date.now()
        });
    }

    /**
     * Handle unhandled promise rejections.
     */
    handlePromiseRejection(e) {
        const reason = e.reason;
        this.sendImmediately('/api/events/error', {
            message: reason?.message || String(reason),
            source: 'unhandled_rejection',
            stack: reason?.stack?.substring(0, 1000) || '',
            page: this.currentPage,
            timestamp: Date.now()
        });
    }

    /**
     * Log session-level events.
     */
    logSessionEvent(eventType, extra = {}) {
        this.sendImmediately('/api/events/session', {
            event: eventType,
            timestamp: Date.now(),
            ...extra
        });
    }

    /**
     * Queue an event for batch sending.
     */
    queueEvent(type, data) {
        this.eventQueue.push({
            type,
            data,
            timestamp: Date.now()
        });

        // Flush if queue is full
        if (this.eventQueue.length >= this.batchSize) {
            this.flush();
        }
    }

    /**
     * Flush the event queue to the server.
     */
    async flush() {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            await fetch('/api/events/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ events }),
                credentials: 'same-origin'
            });
        } catch (error) {
            // Silently fail - don't disrupt the user experience
            console.debug('Activity tracking flush failed:', error);
        }
    }

    /**
     * Send an event immediately (not batched).
     */
    async sendImmediately(endpoint, data) {
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'same-origin'
            });
        } catch (error) {
            console.debug('Activity tracking send failed:', error);
        }
    }

    /**
     * Enable tracking.
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable tracking.
     */
    disable() {
        this.enabled = false;
        this.eventQueue = [];
    }

    /**
     * Clean up resources.
     */
    destroy() {
        clearInterval(this.flushTimer);
        clearTimeout(this.idleTimer);
        this.flush();
    }
}

// Create and export singleton instance
const activityTracker = new ActivityTracker();

export { ActivityTracker, activityTracker };
