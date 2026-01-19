/**
 * Advanced Browser Fingerprinting Library
 * Collects comprehensive device and browser information for security and analytics
 *
 * Privacy Note: This data is used for fraud detection, security monitoring, and
 * improving user experience. No data is shared with third parties.
 */

class BrowserFingerprint {
    constructor() {
        this.data = {};
        this.collectionStartTime = performance.now();
    }

    /**
     * Collect all available fingerprint data
     */
    async collectAll() {
        // Synchronous collection
        this.collectBasicInfo();
        this.collectScreenInfo();
        this.collectNavigatorInfo();
        this.collectStorageInfo();
        this.collectPerformanceInfo();
        this.collectTimezoneInfo();

        // Asynchronous collection
        await Promise.allSettled([
            this.collectCanvasFingerprint(),
            this.collectWebGLFingerprint(),
            this.collectAudioFingerprint(),
            this.collectFonts(),
            this.collectBatteryInfo(),
            this.collectConnectionInfo(),
            this.collectMediaDevices()
        ]);

        this.data.collection_duration_ms = Math.round(performance.now() - this.collectionStartTime);

        return this.data;
    }

    /**
     * Basic browser and system information
     */
    collectBasicInfo() {
        this.data.basic = {
            user_agent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages || [navigator.language],
            platform: navigator.platform,
            vendor: navigator.vendor || 'unknown',
            product: navigator.product || 'unknown',
            product_sub: navigator.productSub || 'unknown',
            vendor_sub: navigator.vendorSub || 'unknown',
            oscpu: navigator.oscpu || 'unknown',
            build_id: navigator.buildID || 'unknown',
            do_not_track: navigator.doNotTrack || window.doNotTrack || 'unknown',
            max_touch_points: navigator.maxTouchPoints || 0,
            hardware_concurrency: navigator.hardwareConcurrency || 'unknown',
            device_memory: navigator.deviceMemory || 'unknown', // GB
            cookie_enabled: navigator.cookieEnabled,
            online: navigator.onLine,
            java_enabled: navigator.javaEnabled ? navigator.javaEnabled() : false
        };
    }

    /**
     * Screen and display information
     */
    collectScreenInfo() {
        this.data.screen = {
            width: screen.width,
            height: screen.height,
            avail_width: screen.availWidth,
            avail_height: screen.availHeight,
            color_depth: screen.colorDepth,
            pixel_depth: screen.pixelDepth,
            orientation: screen.orientation ? {
                type: screen.orientation.type,
                angle: screen.orientation.angle
            } : 'unknown',
            pixel_ratio: window.devicePixelRatio || 1,
            inner_width: window.innerWidth,
            inner_height: window.innerHeight,
            outer_width: window.outerWidth,
            outer_height: window.outerHeight,
            color_gamut: this.detectColorGamut(),
            hdr_capable: this.detectHDR(),
            touch_support: this.detectTouchSupport()
        };
    }

    /**
     * Detect color gamut support
     */
    detectColorGamut() {
        if (window.matchMedia) {
            if (window.matchMedia('(color-gamut: rec2020)').matches) return 'rec2020';
            if (window.matchMedia('(color-gamut: p3)').matches) return 'p3';
            if (window.matchMedia('(color-gamut: srgb)').matches) return 'srgb';
        }
        return 'unknown';
    }

    /**
     * Detect HDR support
     */
    detectHDR() {
        if (window.matchMedia) {
            return window.matchMedia('(dynamic-range: high)').matches;
        }
        return false;
    }

    /**
     * Detect touch support
     */
    detectTouchSupport() {
        return {
            max_touch_points: navigator.maxTouchPoints || 0,
            touch_event: 'ontouchstart' in window,
            touch_start_event: 'TouchEvent' in window,
            pointer_event: 'PointerEvent' in window
        };
    }

    /**
     * Navigator API information
     */
    collectNavigatorInfo() {
        this.data.capabilities = {
            // Browser features
            service_worker: 'serviceWorker' in navigator,
            notification: 'Notification' in window,
            geolocation: 'geolocation' in navigator,
            bluetooth: 'bluetooth' in navigator,
            usb: 'usb' in navigator,
            webgl: this.hasWebGL(),
            webgl2: this.hasWebGL2(),
            webrtc: this.hasWebRTC(),
            web_assembly: typeof WebAssembly !== 'undefined',
            web_audio: 'AudioContext' in window || 'webkitAudioContext' in window,
            websocket: 'WebSocket' in window,
            worker: 'Worker' in window,
            shared_worker: 'SharedWorker' in window,
            indexed_db: 'indexedDB' in window,

            // Storage APIs
            local_storage: this.hasLocalStorage(),
            session_storage: this.hasSessionStorage(),

            // Media APIs
            media_devices: 'mediaDevices' in navigator,
            media_recorder: 'MediaRecorder' in window,

            // Payment & Credentials
            payment_request: 'PaymentRequest' in window,
            credentials: 'credentials' in navigator,

            // Permissions API
            permissions: 'permissions' in navigator
        };
    }

    /**
     * Check WebGL support
     */
    hasWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    /**
     * Check WebGL2 support
     */
    hasWebGL2() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch (e) {
            return false;
        }
    }

    /**
     * Check WebRTC support
     */
    hasWebRTC() {
        return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
                  navigator.mozGetUserMedia || navigator.mediaDevices);
    }

    /**
     * Check localStorage support
     */
    hasLocalStorage() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check sessionStorage support
     */
    hasSessionStorage() {
        try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Storage and quota information
     */
    collectStorageInfo() {
        this.data.storage = {
            local_storage_available: this.hasLocalStorage(),
            session_storage_available: this.hasSessionStorage(),
            indexed_db_available: 'indexedDB' in window,
            cookies_enabled: navigator.cookieEnabled
        };

        // Get storage estimate if available
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                this.data.storage.quota = estimate.quota;
                this.data.storage.usage = estimate.usage;
                this.data.storage.usage_percentage = ((estimate.usage / estimate.quota) * 100).toFixed(2);
            }).catch(() => {});
        }
    }

    /**
     * Performance and memory information
     */
    collectPerformanceInfo() {
        this.data.performance = {
            memory: performance.memory ? {
                js_heap_size_limit: performance.memory.jsHeapSizeLimit,
                total_js_heap_size: performance.memory.totalJSHeapSize,
                used_js_heap_size: performance.memory.usedJSHeapSize
            } : null,
            timing: performance.timing ? {
                navigation_start: performance.timing.navigationStart,
                dom_complete: performance.timing.domComplete,
                load_event_end: performance.timing.loadEventEnd,
                dom_content_loaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                page_load_time: performance.timing.loadEventEnd - performance.timing.navigationStart
            } : null
        };
    }

    /**
     * Detailed timezone information
     */
    collectTimezoneInfo() {
        const date = new Date();
        this.data.timezone = {
            offset: date.getTimezoneOffset(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
            calendar: Intl.DateTimeFormat().resolvedOptions().calendar || 'unknown',
            hour_cycle: Intl.DateTimeFormat().resolvedOptions().hourCycle || 'unknown'
        };
    }

    /**
     * Canvas fingerprint - unique device identifier
     */
    async collectCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 60;
            const ctx = canvas.getContext('2d');

            // Draw complex pattern
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Browser Fingerprint 🔒 <@>', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Browser Fingerprint 🔒 <@>', 4, 17);

            // Get canvas data URL
            const dataURL = canvas.toDataURL();

            // Calculate hash
            this.data.canvas = {
                hash: await this.hashString(dataURL),
                length: dataURL.length
            };
        } catch (e) {
            this.data.canvas = { error: e.message };
        }
    }

    /**
     * WebGL fingerprint - GPU and graphics info
     */
    async collectWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

            if (!gl) {
                this.data.webgl = { supported: false };
                return;
            }

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

            this.data.webgl = {
                supported: true,
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION),
                shading_language_version: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                unmasked_vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
                unmasked_renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
                max_texture_size: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                max_viewport_dims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                extensions: gl.getSupportedExtensions()
            };

            // Calculate WebGL fingerprint hash
            const webglString = JSON.stringify(this.data.webgl);
            this.data.webgl.hash = await this.hashString(webglString);
        } catch (e) {
            this.data.webgl = { error: e.message };
        }
    }

    /**
     * Audio context fingerprint
     */
    async collectAudioFingerprint() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                this.data.audio = { supported: false };
                return;
            }

            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gainNode = context.createGain();
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

            gainNode.gain.value = 0; // Mute
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.start(0);

            const audioData = await new Promise((resolve) => {
                scriptProcessor.onaudioprocess = function(event) {
                    const output = event.outputBuffer.getChannelData(0);
                    const data = Array.from(output.slice(0, 30));
                    resolve(data);
                    scriptProcessor.disconnect();
                    oscillator.disconnect();
                    analyser.disconnect();
                    gainNode.disconnect();
                };
            });

            context.close();

            this.data.audio = {
                supported: true,
                sample_rate: context.sampleRate,
                hash: await this.hashString(JSON.stringify(audioData)),
                state: context.state
            };
        } catch (e) {
            this.data.audio = { error: e.message };
        }
    }

    /**
     * Detect installed fonts
     */
    async collectFonts() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testFonts = [
            'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
            'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
            'Arial Black', 'Impact', 'Lucida Sans Unicode', 'Tahoma', 'Century Gothic',
            'Helvetica', 'Monaco', 'Consolas', 'Calibri', 'Cambria'
        ];

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const text = 'mmmmmmmmmmlli';
        const textSize = '72px';

        const baseFontSizes = {};
        baseFonts.forEach(baseFont => {
            context.font = `${textSize} ${baseFont}`;
            baseFontSizes[baseFont] = context.measureText(text).width;
        });

        const detectedFonts = [];
        testFonts.forEach(font => {
            let detected = false;
            baseFonts.forEach(baseFont => {
                context.font = `${textSize} '${font}', ${baseFont}`;
                const width = context.measureText(text).width;
                if (width !== baseFontSizes[baseFont]) {
                    detected = true;
                }
            });
            if (detected) {
                detectedFonts.push(font);
            }
        });

        this.data.fonts = {
            detected: detectedFonts,
            count: detectedFonts.count,
            hash: await this.hashString(detectedFonts.join(','))
        };
    }

    /**
     * Battery information (if available)
     */
    async collectBatteryInfo() {
        try {
            if (navigator.getBattery) {
                const battery = await navigator.getBattery();
                this.data.battery = {
                    charging: battery.charging,
                    level: battery.level,
                    charging_time: battery.chargingTime,
                    discharging_time: battery.dischargingTime
                };
            } else {
                this.data.battery = { supported: false };
            }
        } catch (e) {
            this.data.battery = { error: e.message };
        }
    }

    /**
     * Connection information
     */
    async collectConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (connection) {
            this.data.connection = {
                effective_type: connection.effectiveType,
                downlink: connection.downlink,
                downlink_max: connection.downlinkMax,
                rtt: connection.rtt,
                save_data: connection.saveData,
                type: connection.type || 'unknown'
            };
        } else {
            this.data.connection = { supported: false };
        }
    }

    /**
     * Media devices (with permission check)
     */
    async collectMediaDevices() {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.data.media_devices = {
                    audio_input: devices.filter(d => d.kind === 'audioinput').length,
                    audio_output: devices.filter(d => d.kind === 'audiooutput').length,
                    video_input: devices.filter(d => d.kind === 'videoinput').length,
                    total: devices.length
                };
            } else {
                this.data.media_devices = { supported: false };
            }
        } catch (e) {
            this.data.media_devices = { error: e.message };
        }
    }

    /**
     * Hash a string using SubtleCrypto API
     */
    async hashString(str) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex.substring(0, 16); // First 16 chars for brevity
        } catch (e) {
            // Fallback to simple hash
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        }
    }

    /**
     * Generate a composite fingerprint hash
     */
    async generateFingerprint() {
        await this.collectAll();

        // Combine key identifiers
        const fingerprintString = JSON.stringify({
            canvas: this.data.canvas?.hash,
            webgl: this.data.webgl?.hash,
            audio: this.data.audio?.hash,
            fonts: this.data.fonts?.hash,
            screen: `${this.data.screen?.width}x${this.data.screen?.height}x${this.data.screen?.color_depth}`,
            timezone: this.data.timezone?.offset,
            platform: this.data.basic?.platform,
            hardware: this.data.basic?.hardware_concurrency
        });

        const fingerprint = await this.hashString(fingerprintString);
        this.data.composite_fingerprint = fingerprint;

        return fingerprint;
    }
}

/**
 * Send fingerprint data to server
 */
async function sendFingerprintToServer(endpoint = '/api/fingerprint') {
    try {
        const fp = new BrowserFingerprint();
        await fp.generateFingerprint();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fp.data)
        });

        if (!response.ok) {
            console.warn('Fingerprint submission failed:', response.status);
        }

        return fp.data;
    } catch (error) {
        console.error('Error collecting fingerprint:', error);
        return null;
    }
}

// Export for use in other modules
export { BrowserFingerprint, sendFingerprintToServer };
