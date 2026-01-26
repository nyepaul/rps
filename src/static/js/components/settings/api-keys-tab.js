/**
 * API Keys Settings Tab - Secure management of LLM API keys
 */

import { store } from '../../state/store.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Render the API Keys settings tab
 */
export function renderAPIKeysTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔐</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to manage API keys.
                </p>
                <button id="go-to-welcome-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
        return;
    }

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
            <!-- Header -->
            <div style="margin-bottom: 30px;">
                <h1 style="font-size: 24px; margin-bottom: 10px;">🔐 API Key Management</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">
                    Securely store and manage API keys for AI services. All keys are encrypted using AES-256-GCM.
                </p>
            </div>

            <!-- Security Notice -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 30px; color: white;">
                <div style="display: flex; align-items: start; gap: 15px;">
                    <div style="font-size: 32px;">🔒</div>
                    <div>
                        <h3 style="margin: 0 0 8px 0; font-size: 16px;">Your Keys Are Secure</h3>
                        <p style="margin: 0; font-size: 13px; line-height: 1.5; opacity: 0.95;">
                            API keys are encrypted at rest using AES-256-GCM with PBKDF2 key derivation (100,000 iterations).
                            Keys are stored per-profile and are never transmitted to external services except when making authorized API calls.
                        </p>
                    </div>
                </div>
            </div>

            <!-- API Keys Form -->
            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                <h2 style="font-size: 18px; margin-bottom: 20px;">Configure API Keys</h2>

                <!-- Claude API Key -->
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        🤖 Anthropic Claude API Key
                    </label>
                    <p style="color: var(--text-secondary); font-size: 12px; margin: 0 0 10px 0;">
                        Get your API key from <a href="https://console.anthropic.com/" target="_blank" style="color: var(--accent-color);">console.anthropic.com</a>
                    </p>
                    <div style="position: relative;">
                        <input
                            type="password"
                            id="claude-api-key"
                            placeholder="sk-ant-..."
                            style="width: 100%; padding: 12px 45px 12px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: 'Courier New', monospace; font-size: 13px;"
                        />
                        <button
                            id="toggle-claude-key"
                            type="button"
                            style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 18px; padding: 5px;"
                            title="Show/Hide Key"
                        >👁️</button>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button
                            id="test-claude-btn"
                            style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;"
                        >
                            🧪 Test Connection
                        </button>
                        <button
                            id="clear-claude-btn"
                            style="padding: 8px 16px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;"
                        >
                            🗑️ Clear
                        </button>
                    </div>
                    <div id="claude-status" style="margin-top: 10px; font-size: 12px;"></div>
                </div>

                <!-- Gemini API Key -->
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        ✨ Google Gemini API Key
                    </label>
                    <p style="color: var(--text-secondary); font-size: 12px; margin: 0 0 10px 0;">
                        Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" style="color: var(--accent-color);">Google AI Studio</a>
                    </p>
                    <div style="position: relative;">
                        <input
                            type="password"
                            id="gemini-api-key"
                            placeholder="AIzaSy..."
                            style="width: 100%; padding: 12px 45px 12px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: 'Courier New', monospace; font-size: 13px;"
                        />
                        <button
                            id="toggle-gemini-key"
                            type="button"
                            style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 18px; padding: 5px;"
                            title="Show/Hide Key"
                        >👁️</button>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button
                            id="test-gemini-btn"
                            style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;"
                        >
                            🧪 Test Connection
                        </button>
                        <button
                            id="clear-gemini-btn"
                            style="padding: 8px 16px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;"
                        >
                            🗑️ Clear
                        </button>
                    </div>
                    <div id="gemini-status" style="margin-top: 10px; font-size: 12px;"></div>
                </div>

                <!-- Save Button -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                    <button
                        id="save-api-keys-btn"
                        style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;"
                    >
                        💾 Save API Keys
                    </button>
                    <span id="save-status" style="margin-left: 15px; font-size: 13px;"></span>
                </div>
            </div>

            <!-- System Information -->
            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 30px;">
                <h2 style="font-size: 18px; margin-bottom: 20px;">🛡️ Security & System Information</h2>

                <div style="display: grid; gap: 20px;">
                    <!-- Version Information -->
                    <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; border: 2px solid var(--accent-color);">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            ℹ️ Version Information
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>System:</strong> Retirement Planning System (RPS)<br>
                            <strong>Version:</strong> ${store.get('appVersion') || 'Loading...'}<br>
                            <strong>Authored by:</strong> pan<br>
                            <strong>Released:</strong> ${store.get('appReleaseDate') || 'Loading...'}
                        </p>
                    </div>

                    <!-- Encryption -->
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            🔐 Encryption
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>Algorithm:</strong> AES-256-GCM (Galois/Counter Mode)<br>
                            <strong>Key Derivation:</strong> PBKDF2 with SHA256, 100,000 iterations<br>
                            <strong>Initialization Vector:</strong> 12-byte random IV per record<br>
                            <strong>Scope:</strong> All profile data, assets, scenarios, and API keys encrypted at rest
                        </p>
                    </div>

                    <!-- Authentication -->
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            👤 Authentication
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>Password Hashing:</strong> bcrypt with adaptive cost factor<br>
                            <strong>Session Management:</strong> Flask-Login with secure server-side sessions<br>
                            <strong>Rate Limiting:</strong> Flask-Limiter protects against brute force attacks
                        </p>
                    </div>

                    <!-- Data Isolation -->
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            🔒 Data Isolation
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>User Segregation:</strong> All data is user-specific with strict access controls<br>
                            <strong>Profile Isolation:</strong> Each profile's data is independently encrypted<br>
                            <strong>API Keys:</strong> Stored per-profile, never shared across users or profiles
                        </p>
                    </div>

                    <!-- Storage -->
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            💾 Storage
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>Database:</strong> SQLite with encrypted profile data<br>
                            <strong>Local Storage:</strong> Browser localStorage for UI preferences only (no sensitive data)<br>
                            <strong>Backups:</strong> Encrypted backups maintain same security guarantees
                        </p>
                    </div>

                    <!-- Audit Trail -->
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            📋 Audit & Compliance
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>Audit Logging:</strong> All data access and modifications logged<br>
                            <strong>Timestamps:</strong> Created/updated timestamps on all records<br>
                            <strong>User Attribution:</strong> All actions tied to authenticated user accounts
                        </p>
                    </div>

                    <!-- API Key Usage -->
                    <div>
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                            🔑 API Key Usage
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong>Storage:</strong> Keys encrypted with user-specific DEK (Data Encryption Key)<br>
                            <strong>Transmission:</strong> Keys sent only to official API endpoints (anthropic.com, googleapis.com)<br>
                            <strong>Caching:</strong> Keys cached in encrypted session only, never logged<br>
                            <strong>Rotation:</strong> Update keys anytime; old keys immediately invalidated
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup event handlers
    setupAPIKeyHandlers(container, profile);

    // Load existing keys (masked)
    loadExistingKeys(container, profile);
}

/**
 * Setup event handlers for API key management
 */
function setupAPIKeyHandlers(container, profile) {
    // Toggle visibility buttons
    const toggleClaudeBtn = container.querySelector('#toggle-claude-key');
    const claudeInput = container.querySelector('#claude-api-key');

    toggleClaudeBtn.addEventListener('click', () => {
        const isPassword = claudeInput.type === 'password';
        claudeInput.type = isPassword ? 'text' : 'password';
        toggleClaudeBtn.textContent = isPassword ? '🙈' : '👁️';
    });

    const toggleGeminiBtn = container.querySelector('#toggle-gemini-key');
    const geminiInput = container.querySelector('#gemini-api-key');

    toggleGeminiBtn.addEventListener('click', () => {
        const isPassword = geminiInput.type === 'password';
        geminiInput.type = isPassword ? 'text' : 'password';
        toggleGeminiBtn.textContent = isPassword ? '🙈' : '👁️';
    });

    // Clear buttons
    container.querySelector('#clear-claude-btn').addEventListener('click', () => {
        claudeInput.value = '';
        container.querySelector('#claude-status').textContent = '';
    });

    container.querySelector('#clear-gemini-btn').addEventListener('click', () => {
        geminiInput.value = '';
        container.querySelector('#gemini-status').textContent = '';
    });

    // Test connection buttons - auto-save on success
    container.querySelector('#test-claude-btn').addEventListener('click', async () => {
        const success = await testAPIKey('claude', claudeInput.value, container.querySelector('#claude-status'));
        if (success) {
            await saveAPIKeys(profile, claudeInput.value, geminiInput.value, container.querySelector('#save-status'));
        }
    });

    container.querySelector('#test-gemini-btn').addEventListener('click', async () => {
        const success = await testAPIKey('gemini', geminiInput.value, container.querySelector('#gemini-status'));
        if (success) {
            await saveAPIKeys(profile, claudeInput.value, geminiInput.value, container.querySelector('#save-status'));
        }
    });

    // Save button
    container.querySelector('#save-api-keys-btn').addEventListener('click', async () => {
        await saveAPIKeys(profile, claudeInput.value, geminiInput.value, container.querySelector('#save-status'));
    });
}

/**
 * Load existing API keys (masked) from backend
 */
async function loadExistingKeys(container, profile) {
    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`);

        if (response.ok) {
            const data = await response.json();

            // Show masked versions if keys exist
            if (data.claude_api_key) {
                const claudeInput = container.querySelector('#claude-api-key');
                claudeInput.placeholder = '••••••••' + data.claude_api_key.slice(-4);
                container.querySelector('#claude-status').innerHTML =
                    '<span style="color: var(--success-color);">✓ Key configured</span>';
            }

            if (data.gemini_api_key) {
                const geminiInput = container.querySelector('#gemini-api-key');
                geminiInput.placeholder = '••••••••' + data.gemini_api_key.slice(-4);
                container.querySelector('#gemini-status').innerHTML =
                    '<span style="color: var(--success-color);">✓ Key configured</span>';
            }
        }
    } catch (error) {
        console.error('Error loading API keys:', error);
        // Silently fail - not having keys is normal for new profiles
    }
}

/**
 * Test API key connection
 * @returns {boolean} true if test succeeded
 */
async function testAPIKey(provider, apiKey, statusElement) {
    if (!apiKey || apiKey.trim() === '') {
        statusElement.innerHTML = '<span style="color: var(--danger-color);">⚠️ Please enter an API key</span>';
        return false;
    }

    statusElement.innerHTML = '<span style="color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px;"><span class="spinner" style="width: 14px; height: 14px; border: 2px solid var(--border-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;"></span>Testing connection...</span><style>@keyframes spin { to { transform: rotate(360deg); }}</style>';

    try {
        const response = await fetch('/api/test-api-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider,
                api_key: apiKey
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            statusElement.innerHTML = `<span style="color: var(--success-color);">✓ Success! ${result.model || ''} (auto-saving...)</span>`;
            return true;
        } else {
            statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ ${result.error || 'Connection failed'}</span>`;
            return false;
        }
    } catch (error) {
        statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ Error: ${error.message}</span>`;
        return false;
    }
}

/**
 * Save API keys to backend (encrypted)
 */
async function saveAPIKeys(profile, claudeKey, geminiKey, statusElement) {
    // Validate at least one key is provided
    if (!claudeKey && !geminiKey) {
        statusElement.innerHTML = '<span style="color: var(--danger-color);">⚠️ Please enter at least one API key</span>';
        return;
    }

    statusElement.innerHTML = '<span style="color: var(--text-secondary);">💾 Saving...</span>';

    try {
        const payload = {};
        if (claudeKey && claudeKey.trim() !== '') {
            payload.claude_api_key = claudeKey.trim();
        }
        if (geminiKey && geminiKey.trim() !== '') {
            payload.gemini_api_key = geminiKey.trim();
        }

        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.innerHTML = '<span style="color: var(--success-color);">✓ API keys saved successfully</span>';
            showSuccess('API keys saved and encrypted');

            // Clear inputs and reload masked versions
            setTimeout(() => {
                location.reload(); // Reload to show masked keys
            }, 1500);
        } else {
            statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ ${result.error || 'Failed to save'}</span>`;
            showError(result.error || 'Failed to save API keys');
        }
    } catch (error) {
        statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ Error: ${error.message}</span>`;
        showError(`Error saving API keys: ${error.message}`);
    }
}
