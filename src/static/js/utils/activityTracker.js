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

        // Enhanced fingerprinting cache (computed once per session)
        this._fingerprintCache = null;
        this._fingerprintTimestamp = null;
        this._performanceMetrics = null;

        // Scroll tracking
        this.maxScrollDepth = 0;
        this.scrollMilestones = new Set();

        // Engagement tracking
        this.clickCount = 0;
        this.keyPressCount = 0;
        this.scrollEventCount = 0;

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

        // Track scroll depth
        document.addEventListener('scroll', () => this.trackScrollDepth(), { passive: true });

        // Track key presses for engagement
        document.addEventListener('keydown', () => { this.keyPressCount++; }, { passive: true });

        // Collect comprehensive fingerprint on session start
        this.collectFingerprint().then(fingerprint => {
            this._fingerprintCache = fingerprint;
            this._fingerprintTimestamp = Date.now();
        });

        // Collect performance metrics after page load
        if (document.readyState === 'complete') {
            this._performanceMetrics = this.collectPerformanceMetrics();
        } else {
            window.addEventListener('load', () => {
                this._performanceMetrics = this.collectPerformanceMetrics();
            });
        }

        // Log session start with enhanced data
        this.logSessionEvent('start');
    }

    /**
     * Collect comprehensive browser fingerprint data.
     * This creates a unique signature for the browser/device.
     */
    async collectFingerprint() {
        const fingerprint = {
            timestamp: Date.now(),
            basic: this.collectBasicInfo(),
            screen: this.collectScreenInfo(),
            hardware: this.collectHardwareInfo(),
            capabilities: this.collectCapabilities(),
            network: await this.collectNetworkInfo(),
            storage: this.collectStorageInfo(),
            timezone: this.collectTimezoneInfo(),
            webgl: this.collectWebGLInfo(),
            canvas: this.collectCanvasFingerprint(),
            audio: await this.collectAudioFingerprint(),
            fonts: this.collectFontInfo(),
            permissions: await this.collectPermissions(),
            preferences: this.collectPreferences(),
            plugins: this.collectPluginInfo(),
            media: await this.collectMediaDevices()
        };

        // Generate composite fingerprint hash
        fingerprint.composite_fingerprint = this.hashFingerprint(fingerprint);

        return fingerprint;
    }

    /**
     * Collect basic browser/platform information.
     */
    collectBasicInfo() {
        const nav = navigator;
        return {
            user_agent: nav.userAgent,
            platform: nav.platform,
            vendor: nav.vendor,
            product: nav.product,
            product_sub: nav.productSub,
            app_name: nav.appName,
            app_version: nav.appVersion,
            language: nav.language,
            languages: Array.from(nav.languages || []),
            cookie_enabled: nav.cookieEnabled,
            do_not_track: nav.doNotTrack,
            hardware_concurrency: nav.hardwareConcurrency,
            device_memory: nav.deviceMemory,
            max_touch_points: nav.maxTouchPoints,
            webdriver: nav.webdriver,
            pdf_viewer_enabled: nav.pdfViewerEnabled,
            build_id: nav.buildID  // Firefox specific
        };
    }

    /**
     * Collect screen and display information.
     */
    collectScreenInfo() {
        const screen = window.screen;
        return {
            width: screen.width,
            height: screen.height,
            avail_width: screen.availWidth,
            avail_height: screen.availHeight,
            color_depth: screen.colorDepth,
            pixel_depth: screen.pixelDepth,
            device_pixel_ratio: window.devicePixelRatio,
            orientation_type: screen.orientation?.type,
            orientation_angle: screen.orientation?.angle,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            outer_width: window.outerWidth,
            outer_height: window.outerHeight,
            screen_left: window.screenLeft,
            screen_top: window.screenTop
        };
    }

    /**
     * Collect hardware information.
     */
    collectHardwareInfo() {
        const info = {
            cpu_cores: navigator.hardwareConcurrency,
            device_memory_gb: navigator.deviceMemory,
            max_touch_points: navigator.maxTouchPoints,
            pointer_type: this.detectPointerType()
        };

        // Battery status (if available)
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                info.battery_charging = battery.charging;
                info.battery_level = Math.round(battery.level * 100);
                info.battery_charging_time = battery.chargingTime;
                info.battery_discharging_time = battery.dischargingTime;
            }).catch(() => {});
        }

        return info;
    }

    /**
     * Detect the primary pointer type.
     */
    detectPointerType() {
        if (window.matchMedia('(pointer: coarse)').matches) return 'coarse'; // Touch
        if (window.matchMedia('(pointer: fine)').matches) return 'fine'; // Mouse
        if (window.matchMedia('(pointer: none)').matches) return 'none';
        return 'unknown';
    }

    /**
     * Collect browser capabilities.
     */
    collectCapabilities() {
        return {
            // APIs
            service_worker: 'serviceWorker' in navigator,
            web_worker: typeof Worker !== 'undefined',
            shared_worker: typeof SharedWorker !== 'undefined',
            websocket: 'WebSocket' in window,
            webrtc: 'RTCPeerConnection' in window,
            webgl: !!this.getWebGLContext(),
            webgl2: !!this.getWebGL2Context(),
            webgpu: 'gpu' in navigator,
            web_audio: 'AudioContext' in window || 'webkitAudioContext' in window,
            web_assembly: typeof WebAssembly !== 'undefined',
            geolocation: 'geolocation' in navigator,
            notifications: 'Notification' in window,
            push: 'PushManager' in window,
            bluetooth: 'bluetooth' in navigator,
            usb: 'usb' in navigator,
            midi: 'requestMIDIAccess' in navigator,
            gamepad: 'getGamepads' in navigator,
            vibrate: 'vibrate' in navigator,
            speech_synthesis: 'speechSynthesis' in window,
            speech_recognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
            clipboard: 'clipboard' in navigator,
            share: 'share' in navigator,

            // Features
            css_grid: CSS.supports('display', 'grid'),
            css_flexbox: CSS.supports('display', 'flex'),
            css_variables: CSS.supports('--test', '0'),
            intersection_observer: 'IntersectionObserver' in window,
            resize_observer: 'ResizeObserver' in window,
            mutation_observer: 'MutationObserver' in window,

            // Touch
            touch_support: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            touch_events: 'TouchEvent' in window,

            // Storage
            local_storage: this.testLocalStorage(),
            session_storage: this.testSessionStorage(),
            indexed_db: 'indexedDB' in window,

            // Media
            media_source: 'MediaSource' in window,
            encrypted_media: 'requestMediaKeySystemAccess' in navigator,

            // Other
            performance_api: 'performance' in window,
            beacon: 'sendBeacon' in navigator
        };
    }

    /**
     * Test localStorage availability.
     */
    testLocalStorage() {
        try {
            localStorage.setItem('__test__', '1');
            localStorage.removeItem('__test__');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test sessionStorage availability.
     */
    testSessionStorage() {
        try {
            sessionStorage.setItem('__test__', '1');
            sessionStorage.removeItem('__test__');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Collect network information.
     */
    async collectNetworkInfo() {
        const info = {};

        // Network Information API
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            info.effective_type = connection.effectiveType; // 4g, 3g, 2g, slow-2g
            info.downlink = connection.downlink; // Mbps
            info.rtt = connection.rtt; // Round-trip time in ms
            info.save_data = connection.saveData;
            info.type = connection.type; // wifi, cellular, ethernet, etc.
        }

        // Online status
        info.online = navigator.onLine;

        return info;
    }

    /**
     * Collect storage information.
     */
    collectStorageInfo() {
        const info = {
            cookies_enabled: navigator.cookieEnabled
        };

        // Estimate storage quota
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
                info.quota_bytes = estimate.quota;
                info.usage_bytes = estimate.usage;
                info.usage_percent = Math.round((estimate.usage / estimate.quota) * 100);
            }).catch(() => {});
        }

        // IndexedDB databases (if accessible)
        if ('databases' in indexedDB) {
            indexedDB.databases().then(dbs => {
                info.indexed_db_count = dbs.length;
            }).catch(() => {});
        }

        return info;
    }

    /**
     * Collect timezone information.
     */
    collectTimezoneInfo() {
        const date = new Date();
        return {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezone_offset: date.getTimezoneOffset(),
            dst_offset: this.getDSTOffset(),
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
            calendar: Intl.DateTimeFormat().resolvedOptions().calendar,
            numbering_system: Intl.DateTimeFormat().resolvedOptions().numberingSystem
        };
    }

    /**
     * Calculate DST offset.
     */
    getDSTOffset() {
        const jan = new Date(new Date().getFullYear(), 0, 1);
        const jul = new Date(new Date().getFullYear(), 6, 1);
        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset()) - new Date().getTimezoneOffset();
    }

    /**
     * Get WebGL context.
     */
    getWebGLContext() {
        try {
            const canvas = document.createElement('canvas');
            return canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        } catch {
            return null;
        }
    }

    /**
     * Get WebGL2 context.
     */
    getWebGL2Context() {
        try {
            const canvas = document.createElement('canvas');
            return canvas.getContext('webgl2');
        } catch {
            return null;
        }
    }

    /**
     * Collect WebGL information for GPU fingerprinting.
     */
    collectWebGLInfo() {
        const gl = this.getWebGLContext();
        if (!gl) return { supported: false };

        try {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                supported: true,
                vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
                renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION),
                shading_language_version: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                max_texture_size: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                max_viewport_dims: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
                max_vertex_attribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                max_vertex_uniform_vectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
                max_fragment_uniform_vectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
                aliased_line_width_range: Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)),
                aliased_point_size_range: Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)),
                extensions: gl.getSupportedExtensions()?.slice(0, 20) // Limit to first 20
            };
        } catch {
            return { supported: true, error: 'Unable to collect WebGL info' };
        }
    }

    /**
     * Generate canvas fingerprint.
     */
    collectCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 60;
            const ctx = canvas.getContext('2d');

            // Draw text with various styles
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Cwm fjordbank', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Cwm fjordbank', 4, 17);

            // Draw shapes
            ctx.beginPath();
            ctx.arc(50, 50, 10, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();

            const dataUrl = canvas.toDataURL();
            return {
                hash: this.simpleHash(dataUrl),
                data_url_length: dataUrl.length
            };
        } catch {
            return { error: 'Canvas fingerprinting blocked or unavailable' };
        }
    }

    /**
     * Generate audio fingerprint using AudioContext.
     */
    async collectAudioFingerprint() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return { supported: false };

            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gainNode = context.createGain();
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

            gainNode.gain.value = 0; // Mute
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(10000, context.currentTime);

            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.start(0);

            // Get frequency data
            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(frequencyData);

            // Clean up
            oscillator.stop();
            context.close();

            return {
                supported: true,
                sample_rate: context.sampleRate,
                state: context.state,
                channel_count: context.destination.channelCount,
                fingerprint_hash: this.simpleHash(frequencyData.slice(0, 100).toString())
            };
        } catch {
            return { supported: false, error: 'Audio fingerprinting unavailable' };
        }
    }

    /**
     * Collect font information.
     */
    collectFontInfo() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testFonts = [
            'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria',
            'Comic Sans MS', 'Consolas', 'Courier', 'Courier New', 'Georgia',
            'Helvetica', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
            'Microsoft Sans Serif', 'Palatino Linotype', 'Tahoma', 'Times',
            'Times New Roman', 'Trebuchet MS', 'Verdana'
        ];

        const detectedFonts = [];
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const getWidth = (fontFamily) => {
            ctx.font = `${testSize} ${fontFamily}`;
            return ctx.measureText(testString).width;
        };

        const baseWidths = baseFonts.map(getWidth);

        for (const font of testFonts) {
            for (let i = 0; i < baseFonts.length; i++) {
                const testFont = `'${font}', ${baseFonts[i]}`;
                if (getWidth(testFont) !== baseWidths[i]) {
                    detectedFonts.push(font);
                    break;
                }
            }
        }

        return {
            detected_count: detectedFonts.length,
            fonts: detectedFonts,
            font_hash: this.simpleHash(detectedFonts.join(','))
        };
    }

    /**
     * Collect permission states.
     */
    async collectPermissions() {
        const permissions = {};
        const permissionNames = [
            'geolocation', 'notifications', 'push', 'midi',
            'camera', 'microphone', 'clipboard-read', 'clipboard-write'
        ];

        for (const name of permissionNames) {
            try {
                const result = await navigator.permissions.query({ name });
                permissions[name] = result.state;
            } catch {
                permissions[name] = 'not_supported';
            }
        }

        return permissions;
    }

    /**
     * Collect user preferences.
     */
    collectPreferences() {
        return {
            color_scheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            reduced_motion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            contrast: window.matchMedia('(prefers-contrast: high)').matches ? 'high' : 'normal',
            reduced_transparency: window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
            forced_colors: window.matchMedia('(forced-colors: active)').matches,
            inverted_colors: window.matchMedia('(inverted-colors: inverted)').matches
        };
    }

    /**
     * Collect plugin information.
     */
    collectPluginInfo() {
        const plugins = [];
        if (navigator.plugins) {
            for (let i = 0; i < Math.min(navigator.plugins.length, 20); i++) {
                const plugin = navigator.plugins[i];
                plugins.push({
                    name: plugin.name,
                    filename: plugin.filename,
                    description: plugin.description?.substring(0, 100)
                });
            }
        }
        return {
            count: navigator.plugins?.length || 0,
            plugins: plugins
        };
    }

    /**
     * Collect media device information.
     */
    async collectMediaDevices() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                return { supported: false };
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                supported: true,
                audio_input_count: devices.filter(d => d.kind === 'audioinput').length,
                audio_output_count: devices.filter(d => d.kind === 'audiooutput').length,
                video_input_count: devices.filter(d => d.kind === 'videoinput').length,
                total_count: devices.length
            };
        } catch {
            return { supported: false, error: 'Unable to enumerate media devices' };
        }
    }

    /**
     * Collect performance metrics.
     */
    collectPerformanceMetrics() {
        if (!('performance' in window)) return null;

        const metrics = {};

        // Navigation timing
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) {
            metrics.navigation = {
                dns_lookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
                tcp_connect: Math.round(nav.connectEnd - nav.connectStart),
                ssl_handshake: Math.round(nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0),
                ttfb: Math.round(nav.responseStart - nav.requestStart), // Time to first byte
                response_time: Math.round(nav.responseEnd - nav.responseStart),
                dom_interactive: Math.round(nav.domInteractive - nav.fetchStart),
                dom_complete: Math.round(nav.domComplete - nav.fetchStart),
                load_complete: Math.round(nav.loadEventEnd - nav.fetchStart),
                transfer_size: nav.transferSize,
                encoded_body_size: nav.encodedBodySize,
                decoded_body_size: nav.decodedBodySize,
                type: nav.type // navigate, reload, back_forward, prerender
            };
        }

        // Paint timing
        const paint = performance.getEntriesByType('paint');
        for (const entry of paint) {
            if (entry.name === 'first-paint') {
                metrics.first_paint = Math.round(entry.startTime);
            } else if (entry.name === 'first-contentful-paint') {
                metrics.first_contentful_paint = Math.round(entry.startTime);
            }
        }

        // Resource count and size
        const resources = performance.getEntriesByType('resource');
        metrics.resources = {
            count: resources.length,
            total_transfer_size: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
            by_type: {}
        };

        // Count resources by type
        for (const res of resources) {
            const type = res.initiatorType || 'other';
            metrics.resources.by_type[type] = (metrics.resources.by_type[type] || 0) + 1;
        }

        // Memory info (Chrome only)
        if (performance.memory) {
            metrics.memory = {
                js_heap_size_limit: performance.memory.jsHeapSizeLimit,
                total_js_heap_size: performance.memory.totalJSHeapSize,
                used_js_heap_size: performance.memory.usedJSHeapSize
            };
        }

        return metrics;
    }

    /**
     * Track scroll depth.
     */
    trackScrollDepth() {
        this.scrollEventCount++;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.round((scrollTop / scrollHeight) * 100);

        if (scrollPercent > this.maxScrollDepth) {
            this.maxScrollDepth = scrollPercent;
        }

        // Track milestones (25%, 50%, 75%, 100%)
        const milestones = [25, 50, 75, 100];
        for (const milestone of milestones) {
            if (scrollPercent >= milestone && !this.scrollMilestones.has(milestone)) {
                this.scrollMilestones.add(milestone);
                this.queueEvent('scroll_milestone', {
                    milestone: milestone,
                    page: this.currentPage,
                    action_description: `Scrolled to ${milestone}% of page on ${this.currentPage}`
                });
            }
        }
    }

    /**
     * Calculate engagement score (0-100).
     */
    calculateEngagementScore() {
        const sessionDuration = (Date.now() - this.sessionStartTime) / 1000; // seconds

        // Factors for engagement score
        const durationScore = Math.min(sessionDuration / 300, 1) * 30; // Max 30 points for 5+ min
        const clickScore = Math.min(this.clickCount / 20, 1) * 25; // Max 25 points for 20+ clicks
        const scrollScore = Math.min(this.maxScrollDepth / 100, 1) * 20; // Max 20 points for full scroll
        const keyScore = Math.min(this.keyPressCount / 50, 1) * 15; // Max 15 points for 50+ keypresses
        const idleScore = this.isIdle ? 0 : 10; // 10 points if not idle

        return Math.round(durationScore + clickScore + scrollScore + keyScore + idleScore);
    }

    /**
     * Get session analytics summary.
     */
    getSessionAnalytics() {
        return {
            session_duration_seconds: Math.round((Date.now() - this.sessionStartTime) / 1000),
            total_clicks: this.clickCount,
            total_key_presses: this.keyPressCount,
            total_scroll_events: this.scrollEventCount,
            max_scroll_depth: this.maxScrollDepth,
            scroll_milestones_reached: Array.from(this.scrollMilestones),
            is_idle: this.isIdle,
            engagement_score: this.calculateEngagementScore(),
            current_page: this.currentPage
        };
    }

    /**
     * Simple hash function for fingerprinting.
     */
    simpleHash(str) {
        let hash = 0;
        const s = String(str);
        for (let i = 0; i < s.length; i++) {
            const char = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash >>> 0; // Convert to unsigned
    }

    /**
     * Hash the entire fingerprint object.
     */
    hashFingerprint(fingerprint) {
        const str = JSON.stringify({
            basic: fingerprint.basic,
            screen: fingerprint.screen,
            webgl: fingerprint.webgl?.vendor + fingerprint.webgl?.renderer,
            canvas: fingerprint.canvas?.hash,
            audio: fingerprint.audio?.fingerprint_hash,
            fonts: fingerprint.fonts?.font_hash,
            timezone: fingerprint.timezone?.timezone
        });
        return this.simpleHash(str);
    }

    /**
     * Get the cached fingerprint data for sending with events.
     */
    getFingerprintSummary() {
        if (!this._fingerprintCache) return null;

        const fp = this._fingerprintCache;
        return {
            composite_hash: fp.composite_fingerprint,
            screen_resolution: `${fp.screen?.width}x${fp.screen?.height}`,
            viewport_size: `${fp.screen?.viewport_width}x${fp.screen?.viewport_height}`,
            device_pixel_ratio: fp.screen?.device_pixel_ratio,
            timezone: fp.timezone?.timezone,
            timezone_offset: fp.timezone?.timezone_offset,
            language: fp.basic?.language,
            languages: fp.basic?.languages?.slice(0, 3),
            platform: fp.basic?.platform,
            cpu_cores: fp.hardware?.cpu_cores,
            device_memory: fp.hardware?.device_memory_gb,
            touch_points: fp.basic?.max_touch_points,
            webgl_vendor: fp.webgl?.vendor,
            webgl_renderer: fp.webgl?.renderer,
            canvas_hash: fp.canvas?.hash,
            audio_hash: fp.audio?.fingerprint_hash,
            font_count: fp.fonts?.detected_count,
            color_scheme: fp.preferences?.color_scheme,
            reduced_motion: fp.preferences?.reduced_motion,
            network_type: fp.network?.effective_type,
            network_downlink: fp.network?.downlink,
            network_rtt: fp.network?.rtt,
            online: fp.network?.online,
            webdriver: fp.basic?.webdriver,
            do_not_track: fp.basic?.do_not_track
        };
    }

    /**
     * Handle ALL click events with granular detail.
     */
    handleClick(e) {
        this.clickCount++;

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

        // Generate human-readable description
        clickData.action_description = this.generateClickDescription(clickData, interactiveElement);

        this.queueEvent('click', clickData);
    }

    /**
     * Handle right-click (context menu) events.
     */
    handleRightClick(e) {
        const target = e.target;

        const eventData = {
            tag: target.tagName?.toLowerCase() || '',
            element_id: target.id || '',
            element_text: this.getElementText(target),
            element_class: typeof target.className === 'string' ? target.className : '',
            x: e.clientX,
            y: e.clientY,
            page: this.currentPage,
            dom_path: this.getDOMPath(target)
        };

        // Generate descriptive action
        eventData.action_description = this.generateRightClickDescription(eventData);

        this.queueEvent('rightclick', eventData);
    }

    /**
     * Handle double-click events.
     */
    handleDoubleClick(e) {
        const target = e.target;

        const eventData = {
            tag: target.tagName?.toLowerCase() || '',
            element_id: target.id || '',
            element_text: this.getElementText(target),
            x: e.clientX,
            y: e.clientY,
            page: this.currentPage,
            dom_path: this.getDOMPath(target)
        };

        // Generate descriptive action
        eventData.action_description = this.generateDoubleClickDescription(eventData);

        this.queueEvent('dblclick', eventData);
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
     * Generate human-readable description for click events.
     */
    generateClickDescription(clickData, interactiveElement) {
        const page = clickData.page || 'unknown page';
        const text = clickData.element_text || clickData.interactive_text || '';
        const tag = clickData.tag;
        const elementId = clickData.element_id || clickData.interactive_id;
        const interactiveType = clickData.interactive_type;
        const targetUrl = clickData.target_url;

        // Build modifiers string
        const modifiers = [];
        if (clickData.ctrl_key) modifiers.push('Ctrl');
        if (clickData.shift_key) modifiers.push('Shift');
        if (clickData.alt_key) modifiers.push('Alt');
        if (clickData.meta_key) modifiers.push('Meta');
        const modifierStr = modifiers.length > 0 ? ` with ${modifiers.join('+')}` : '';

        // Generate specific descriptions based on element type
        if (interactiveElement) {
            switch (interactiveType) {
                case 'button':
                    return `Clicked button "${text}"${modifierStr} on ${page}`;
                case 'link':
                    if (targetUrl) {
                        return `Clicked link "${text}"${modifierStr} navigating to ${this.shortenUrl(targetUrl)} on ${page}`;
                    }
                    return `Clicked link "${text}"${modifierStr} on ${page}`;
                case 'tab':
                    return `Switched to tab "${text}"${modifierStr} on ${page}`;
                case 'nav':
                    return `Clicked navigation item "${text}"${modifierStr} on ${page}`;
                case 'dropdown-item':
                    return `Selected dropdown option "${text}"${modifierStr} on ${page}`;
                case 'input':
                    return `Focused on input field${elementId ? ` "${elementId}"` : ''}${modifierStr} on ${page}`;
                case 'select':
                    return `Opened dropdown selector${elementId ? ` "${elementId}"` : ''}${modifierStr} on ${page}`;
                case 'textarea':
                    return `Focused on text area${elementId ? ` "${elementId}"` : ''}${modifierStr} on ${page}`;
                default:
                    if (text) {
                        return `Clicked ${interactiveType} "${text}"${modifierStr} on ${page}`;
                    }
                    return `Clicked ${interactiveType}${elementId ? ` "${elementId}"` : ''}${modifierStr} on ${page}`;
            }
        }

        // Non-interactive element
        if (text) {
            return `Clicked ${tag} element containing "${text}"${modifierStr} on ${page}`;
        }

        if (elementId) {
            return `Clicked ${tag} element with id "${elementId}"${modifierStr} on ${page}`;
        }

        return `Clicked ${tag} element${modifierStr} on ${page} at position (${clickData.x}, ${clickData.y})`;
    }

    /**
     * Generate human-readable description for right-click events.
     */
    generateRightClickDescription(eventData) {
        const page = eventData.page || 'unknown page';
        const text = eventData.element_text || '';
        const tag = eventData.tag;
        const elementId = eventData.element_id;

        if (text) {
            return `Right-clicked ${tag} element containing "${text}" on ${page}`;
        }

        if (elementId) {
            return `Right-clicked ${tag} element with id "${elementId}" on ${page}`;
        }

        return `Opened context menu on ${tag} element on ${page}`;
    }

    /**
     * Generate human-readable description for double-click events.
     */
    generateDoubleClickDescription(eventData) {
        const page = eventData.page || 'unknown page';
        const text = eventData.element_text || '';
        const tag = eventData.tag;
        const elementId = eventData.element_id;

        if (text) {
            return `Double-clicked ${tag} element containing "${text}" on ${page}`;
        }

        if (elementId) {
            return `Double-clicked ${tag} element with id "${elementId}" on ${page}`;
        }

        return `Double-clicked ${tag} element on ${page}`;
    }

    /**
     * Shorten URL for display purposes.
     */
    shortenUrl(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            // Return just the path if it's the same domain
            if (urlObj.origin === window.location.origin) {
                return urlObj.pathname + urlObj.search;
            }
            // Return domain + path for external URLs
            return urlObj.hostname + urlObj.pathname.substring(0, 30);
        } catch {
            // Not a valid URL, return truncated
            return url.substring(0, 50);
        }
    }

    /**
     * Track tab/page navigation.
     */
    trackPageView(pageName, profileName = null) {
        const previousPage = this.currentPage;
        this.currentPage = pageName;

        const profileContext = profileName ? ` (profile: ${profileName})` : '';
        const referrerContext = previousPage ? ` from ${previousPage}` : '';

        this.sendImmediately('/api/events/page-view', {
            page: pageName,
            profile_name: profileName,
            referrer: previousPage,
            timestamp: Date.now(),
            action_description: `Navigated to ${pageName}${profileContext}${referrerContext}`
        });
    }

    /**
     * Track tab switches within the app.
     */
    trackTabSwitch(tabName, profileName = null) {
        const profileContext = profileName ? ` for profile ${profileName}` : '';

        this.queueEvent('tab_switch', {
            tab: tabName,
            profile_name: profileName,
            page: this.currentPage,
            action_description: `Switched to "${tabName}" tab${profileContext}`
        });
    }

    /**
     * Track modal open/close.
     */
    trackModal(modalId, action) {
        const isOpen = action === 'open';
        const actionVerb = isOpen ? 'Opened' : 'Closed';

        this.queueEvent(isOpen ? 'modal_open' : 'modal_close', {
            modal_id: modalId,
            page: this.currentPage,
            action_description: `${actionVerb} "${modalId}" modal on ${this.currentPage}`
        });
    }

    /**
     * Track form submissions.
     */
    trackFormSubmit(formId, formName) {
        const formIdentifier = formName || formId || 'form';

        this.queueEvent('form_submit', {
            form_id: formId,
            form_name: formName,
            page: this.currentPage,
            action_description: `Submitted ${formIdentifier} on ${this.currentPage}`
        });
    }

    /**
     * Track search actions.
     */
    trackSearch(searchTerm, resultCount) {
        const truncatedTerm = searchTerm ? searchTerm.substring(0, 50) : '';
        const resultText = resultCount !== undefined ? ` (${resultCount} results)` : '';

        this.queueEvent('search', {
            search_term: truncatedTerm,
            result_count: resultCount,
            page: this.currentPage,
            action_description: `Searched for "${truncatedTerm}"${resultText} on ${this.currentPage}`
        });
    }

    /**
     * Track filter/sort actions.
     */
    trackFilter(filterType, filterValue) {
        this.queueEvent('filter', {
            filter_type: filterType,
            filter_value: filterValue,
            page: this.currentPage,
            action_description: `Applied ${filterType} filter: "${filterValue}" on ${this.currentPage}`
        });
    }

    /**
     * Track expand/collapse actions.
     */
    trackExpandCollapse(sectionId, isExpanded) {
        const action = isExpanded ? 'Expanded' : 'Collapsed';

        this.queueEvent(isExpanded ? 'expand' : 'collapse', {
            section_id: sectionId,
            page: this.currentPage,
            action_description: `${action} section "${sectionId}" on ${this.currentPage}`
        });
    }

    /**
     * Track download actions.
     */
    trackDownload(filename, fileType) {
        const typeContext = fileType ? ` (${fileType})` : '';

        this.queueEvent('download', {
            filename: filename,
            file_type: fileType,
            page: this.currentPage,
            action_description: `Downloaded file "${filename}"${typeContext} from ${this.currentPage}`
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
        const payload = {
            event: eventType,
            timestamp: Date.now(),
            ...extra
        };

        // Include full fingerprint and analytics on session start/end
        if (eventType === 'start') {
            // Fingerprint might still be loading, so we'll send it with the first batch
            payload.session_start_time = this.sessionStartTime;
            payload.url = window.location.href;
            payload.referrer = document.referrer || null;
        } else if (eventType === 'end') {
            payload.session_analytics = this.getSessionAnalytics();
            payload.fingerprint = this.getFingerprintSummary();
            payload.full_fingerprint = this._fingerprintCache;
            payload.performance = this._performanceMetrics;
        }

        this.sendImmediately('/api/events/session', payload);
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
            // Include fingerprint summary and session analytics with batch
            const payload = {
                events,
                fingerprint: this.getFingerprintSummary(),
                session_analytics: this.getSessionAnalytics(),
                performance: this._performanceMetrics
            };

            await fetch('/api/events/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Send screen/viewport info in headers for all requests
                    'X-Screen-Width': String(window.screen.width),
                    'X-Screen-Height': String(window.screen.height),
                    'X-Viewport-Width': String(window.innerWidth),
                    'X-Viewport-Height': String(window.innerHeight),
                    'X-Timezone-Offset': String(new Date().getTimezoneOffset()),
                    'X-Color-Depth': String(window.screen.colorDepth),
                    'X-Device-Pixel-Ratio': String(window.devicePixelRatio || 1)
                },
                body: JSON.stringify(payload),
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
                    'Content-Type': 'application/json',
                    // Include client info in headers
                    'X-Screen-Width': String(window.screen.width),
                    'X-Screen-Height': String(window.screen.height),
                    'X-Viewport-Width': String(window.innerWidth),
                    'X-Viewport-Height': String(window.innerHeight),
                    'X-Timezone-Offset': String(new Date().getTimezoneOffset()),
                    'X-Color-Depth': String(window.screen.colorDepth),
                    'X-Device-Pixel-Ratio': String(window.devicePixelRatio || 1)
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
