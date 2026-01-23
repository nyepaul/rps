/**
 * API Keys Settings Component - For use within settings modal
 */

import { store } from '../../state/store.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Render API Keys settings section
 */
export async function renderAPIKeysSettings(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔐</div>
                <h3 style="margin-bottom: 10px;">No Profile Selected</h3>
                <p style="color: var(--text-secondary); margin: 0;">
                    Please create or select a profile to manage API keys.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <!-- Security Notice -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; color: white;">
            <div style="display: flex; align-items: start; gap: 12px;">
                <div style="font-size: 24px;">🔒</div>
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 14px;">Your Keys Are Secure</h4>
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; opacity: 0.95;">
                        API keys are encrypted using AES-256-GCM with PBKDF2 key derivation (100,000 iterations).
                        Keys are stored per-profile and never transmitted except when making authorized API calls.
                    </p>
                </div>
            </div>
        </div>

        <!-- Claude API Key -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">
                🤖 Anthropic Claude API Key
            </label>
            <p style="color: var(--text-secondary); font-size: 11px; margin: 0 0 8px 0;">
                Get your API key from <a href="https://console.anthropic.com/" target="_blank" style="color: var(--accent-color);">console.anthropic.com</a>
            </p>
            <div style="position: relative;">
                <input
                    type="password"
                    id="claude-api-key"
                    placeholder="sk-ant-..."
                    style="width: 100%; padding: 10px 40px 10px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: 'Courier New', monospace; font-size: 12px;"
                />
                <button
                    id="toggle-claude-key"
                    type="button"
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 16px; padding: 4px;"
                    title="Show/Hide Key"
                >👁️</button>
            </div>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
                <button
                    id="test-claude-btn"
                    style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🧪 Test
                </button>
                <button
                    id="clear-claude-btn"
                    style="padding: 6px 12px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🗑️ Clear
                </button>
            </div>
            <div id="claude-status" style="margin-top: 8px; font-size: 11px;"></div>
        </div>

        <!-- Gemini API Key -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">
                ✨ Google Gemini API Key
            </label>
            <p style="color: var(--text-secondary); font-size: 11px; margin: 0 0 8px 0;">
                Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" style="color: var(--accent-color);">Google AI Studio</a>
            </p>
            <div style="position: relative;">
                <input
                    type="password"
                    id="gemini-api-key"
                    placeholder="AIzaSy..."
                    style="width: 100%; padding: 10px 40px 10px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: 'Courier New', monospace; font-size: 12px;"
                />
                <button
                    id="toggle-gemini-key"
                    type="button"
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 16px; padding: 4px;"
                    title="Show/Hide Key"
                >👁️</button>
            </div>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
                <button
                    id="test-gemini-btn"
                    style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🧪 Test
                </button>
                <button
                    id="clear-gemini-btn"
                    style="padding: 6px 12px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🗑️ Clear
                </button>
            </div>
            <div id="gemini-status" style="margin-top: 8px; font-size: 11px;"></div>
        </div>

        <!-- OpenAI API Key -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">
                🤖 OpenAI API Key
            </label>
            <p style="color: var(--text-secondary); font-size: 11px; margin: 0 0 8px 0;">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--accent-color);">platform.openai.com</a>
            </p>
            <div style="position: relative;">
                <input
                    type="password"
                    id="openai-api-key"
                    placeholder="sk-..."
                    style="width: 100%; padding: 10px 40px 10px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: 'Courier New', monospace; font-size: 12px;"
                />
                <button
                    id="toggle-openai-key"
                    type="button"
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 16px; padding: 4px;"
                    title="Show/Hide Key"
                >👁️</button>
            </div>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
                <button
                    id="test-openai-btn"
                    style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🧪 Test
                </button>
                <button
                    id="clear-openai-btn"
                    style="padding: 6px 12px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🗑️ Clear
                </button>
            </div>
            <div id="openai-status" style="margin-top: 8px; font-size: 11px;"></div>
        </div>

        <!-- Grok API Key -->
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px;">
                🚀 Grok (xAI) API Key
            </label>
            <p style="color: var(--text-secondary); font-size: 11px; margin: 0 0 8px 0;">
                Get your API key from <a href="https://console.x.ai/" target="_blank" style="color: var(--accent-color);">console.x.ai</a>
            </p>
            <div style="position: relative;">
                <input
                    type="password"
                    id="grok-api-key"
                    placeholder="xai-..."
                    style="width: 100%; padding: 10px 40px 10px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: 'Courier New', monospace; font-size: 12px;"
                />
                <button
                    id="toggle-grok-key"
                    type="button"
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 16px; padding: 4px;"
                    title="Show/Hide Key"
                >👁️</button>
            </div>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
                <button
                    id="test-grok-btn"
                    style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🧪 Test
                </button>
                <button
                    id="clear-grok-btn"
                    style="padding: 6px 12px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 12px;"
                >
                    🗑️ Clear
                </button>
            </div>
            <div id="grok-status" style="margin-top: 8px; font-size: 11px;"></div>
        </div>

        <!-- Save Button -->
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border-color);">
            <button
                id="save-api-keys-btn"
                style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;"
            >
                💾 Save API Keys
            </button>
            <span id="api-save-status" style="margin-left: 12px; font-size: 12px;"></span>
        </div>

        <!-- Security Info -->
        <div style="margin-top: 25px; padding: 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
            <h4 style="font-size: 13px; margin: 0 0 10px 0; color: var(--text-primary);">🛡️ Security Details</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 11px; line-height: 1.7; color: var(--text-secondary);">
                <li><strong>Encryption:</strong> AES-256-GCM with 12-byte random IVs</li>
                <li><strong>Key Derivation:</strong> PBKDF2-SHA256, 100,000 iterations</li>
                <li><strong>Storage:</strong> Encrypted at rest in secure database</li>
                <li><strong>Transmission:</strong> Keys sent only to official API endpoints</li>
                <li><strong>Isolation:</strong> Per-profile storage, never shared</li>
                <li><strong>Rotation:</strong> Update anytime; old keys immediately invalidated</li>
            </ul>
        </div>
    `;

    // Setup event handlers
    setupAPIKeyHandlers(container, profile);

    // Load existing keys (masked)
    await loadExistingKeys(container, profile);
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

    const toggleOpenAIBtn = container.querySelector('#toggle-openai-key');
    const openaiInput = container.querySelector('#openai-api-key');

    toggleOpenAIBtn.addEventListener('click', () => {
        const isPassword = openaiInput.type === 'password';
        openaiInput.type = isPassword ? 'text' : 'password';
        toggleOpenAIBtn.textContent = isPassword ? '🙈' : '👁️';
    });

    const toggleGrokBtn = container.querySelector('#toggle-grok-key');
    const grokInput = container.querySelector('#grok-api-key');

    toggleGrokBtn.addEventListener('click', () => {
        const isPassword = grokInput.type === 'password';
        grokInput.type = isPassword ? 'text' : 'password';
        toggleGrokBtn.textContent = isPassword ? '🙈' : '👁️';
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

    container.querySelector('#clear-openai-btn').addEventListener('click', () => {
        openaiInput.value = '';
        container.querySelector('#openai-status').textContent = '';
    });

    container.querySelector('#clear-grok-btn').addEventListener('click', () => {
        grokInput.value = '';
        container.querySelector('#grok-status').textContent = '';
    });

    // Test connection buttons
    container.querySelector('#test-claude-btn').addEventListener('click', async () => {
        await testAPIKey('claude', claudeInput.value, container.querySelector('#claude-status'));
    });

    container.querySelector('#test-gemini-btn').addEventListener('click', async () => {
        await testAPIKey('gemini', geminiInput.value, container.querySelector('#gemini-status'));
    });

    container.querySelector('#test-openai-btn').addEventListener('click', async () => {
        await testAPIKey('openai', openaiInput.value, container.querySelector('#openai-status'));
    });

    container.querySelector('#test-grok-btn').addEventListener('click', async () => {
        await testAPIKey('grok', grokInput.value, container.querySelector('#grok-status'));
    });

    // Save button
    container.querySelector('#save-api-keys-btn').addEventListener('click', async () => {
        await saveAPIKeys(profile, claudeInput.value, geminiInput.value, openaiInput.value, grokInput.value, container.querySelector('#api-save-status'), container);
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

            if (data.openai_api_key) {
                const openaiInput = container.querySelector('#openai-api-key');
                openaiInput.placeholder = '••••••••' + data.openai_api_key.slice(-4);
                container.querySelector('#openai-status').innerHTML =
                    '<span style="color: var(--success-color);">✓ Key configured</span>';
            }

            if (data.grok_api_key) {
                const grokInput = container.querySelector('#grok-api-key');
                grokInput.placeholder = '••••••••' + data.grok_api_key.slice(-4);
                container.querySelector('#grok-status').innerHTML =
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
 */
async function testAPIKey(provider, apiKey, statusElement) {
    if (!apiKey || apiKey.trim() === '') {
        statusElement.innerHTML = '<span style="color: var(--danger-color);">⚠️ Please enter an API key</span>';
        return;
    }

    statusElement.innerHTML = '<span style="color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px;"><span class="spinner" style="width: 14px; height: 14px; border: 2px solid var(--border-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;"></span>Testing...</span><style>@keyframes spin { to { transform: rotate(360deg); }}</style>';

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
            statusElement.innerHTML = `<span style="color: var(--success-color);">✓ Success! ${result.model || ''}</span>`;
        } else {
            statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ ${result.error || 'Failed'}</span>`;
        }
    } catch (error) {
        statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ Error: ${error.message}</span>`;
    }
}

/**
 * Save API keys to backend (encrypted)
 */
async function saveAPIKeys(profile, claudeKey, geminiKey, openaiKey, grokKey, statusElement, container) {
    // Validate at least one key is provided
    if (!claudeKey && !geminiKey && !openaiKey && !grokKey) {
        statusElement.innerHTML = '<span style="color: var(--danger-color);">⚠️ Enter at least one key</span>';
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
        if (openaiKey && openaiKey.trim() !== '') {
            payload.openai_api_key = openaiKey.trim();
        }
        if (grokKey && grokKey.trim() !== '') {
            payload.grok_api_key = grokKey.trim();
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
            statusElement.innerHTML = '<span style="color: var(--success-color);">✓ Saved successfully</span>';
            showSuccess('API keys saved and encrypted');

            // Clear inputs and reload masked versions
            setTimeout(async () => {
                const claudeInput = container.querySelector('#claude-api-key');
                const geminiInput = container.querySelector('#gemini-api-key');
                const openaiInput = container.querySelector('#openai-api-key');
                const grokInput = container.querySelector('#grok-api-key');
                claudeInput.value = '';
                geminiInput.value = '';
                openaiInput.value = '';
                grokInput.value = '';
                await loadExistingKeys(container, profile);
            }, 1000);
        } else {
            statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ ${result.error || 'Failed'}</span>`;
            showError(result.error || 'Failed to save API keys');
        }
    } catch (error) {
        statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ Error: ${error.message}</span>`;
        showError(`Error saving API keys: ${error.message}`);
    }
}
