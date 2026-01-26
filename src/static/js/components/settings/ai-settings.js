/**
 * AI Settings Component - For use within settings modal
 */

import { store } from '../../state/store.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Render AI settings section
 */
export async function renderAPIKeysSettings(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">🤖</div>
                <h3 style="margin-bottom: 10px;">No Profile Selected</h3>
                <p style="color: var(--text-secondary); margin: 0;">
                    Please create or select a profile to manage AI settings.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <!-- Header & Security Notice -->
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px; color: white;">
            <div style="display: flex; align-items: start; gap: 15px;">
                <div style="font-size: 32px;">🧠</div>
                <div>
                    <h4 style="margin: 0 0 8px 0; font-size: 16px;">AI Intelligence Center</h4>
                    <p style="margin: 0; font-size: 12px; line-height: 1.6; opacity: 0.9;">
                        Configure your preferred AI providers to enable smart retirement advice, document extraction, and personalized strategy. 
                        <strong>Encryption:</strong> Keys are secured with AES-256-GCM and stored locally in your encrypted profile.
                    </p>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Left Column: Primary Providers -->
            <div>
                <h3 style="font-size: 14px; margin-bottom: 15px; color: var(--accent-color); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Primary Providers</h3>
                
                ${renderKeyInput('gemini', '✨ Google Gemini', 'AIzaSy...', 'https://aistudio.google.com/app/apikey')}
                ${renderKeyInput('claude', '🤖 Anthropic Claude', 'sk-ant-...', 'https://console.anthropic.com/')}
                ${renderKeyInput('openai', '🧠 OpenAI (GPT-4o)', 'sk-...', 'https://platform.openai.com/api-keys')}
                ${renderKeyInput('grok', '🚀 xAI Grok', 'xai-...', 'https://console.x.ai/')}
            </div>

            <!-- Right Column: Specialized & Free Providers -->
            <div>
                <h3 style="font-size: 14px; margin-bottom: 15px; color: var(--accent-color); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Alternative & Free Tools</h3>
                
                ${renderKeyInput('openrouter', '🌐 OpenRouter (Aggregator)', 'sk-or-...', 'https://openrouter.ai/keys')}
                ${renderKeyInput('deepseek', '🐳 DeepSeek', 'sk-...', 'https://platform.deepseek.com/')}
                ${renderKeyInput('mistral', '🌀 Mistral AI', '...', 'https://console.mistral.ai/')}
                ${renderKeyInput('together', '🤝 Together AI', '...', 'https://api.together.xyz/')}
                ${renderKeyInput('huggingface', '🤗 Hugging Face', 'hf_...', 'https://huggingface.co/settings/tokens')}
            </div>
        </div>

        <!-- Preferred Provider Selection -->
        <div style="margin-top: 20px; padding: 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="font-size: 14px; margin: 0 0 10px 0; color: var(--accent-color);">🎯 Default AI Provider</h3>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">
                Select which provider should handle your advisor chat and analysis by default.
            </p>
            <select id="preferred-ai-provider" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px;">
                <option value="gemini">✨ Google Gemini (Recommended)</option>
                <option value="claude">🤖 Anthropic Claude</option>
                <option value="openai">🧠 OpenAI (GPT-4o)</option>
                <option value="grok">🚀 xAI Grok</option>
                <option value="openrouter">🌐 OpenRouter</option>
                <option value="deepseek">🐳 DeepSeek</option>
                <option value="mistral">🌀 Mistral AI</option>
                <option value="together">🤝 Together AI</option>
                <option value="huggingface">🤗 Hugging Face</option>
                <option value="ollama">🏠 Local Ollama</option>
                <option value="lmstudio">💻 LM Studio</option>
                <option value="localai">🤖 LocalAI</option>
            </select>
        </div>

        <!-- Local AI Section -->
        <div style="margin-top: 20px; padding: 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="font-size: 14px; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
                🏠 Local AI & Privacy Tools
                <span style="font-size: 10px; font-weight: normal; background: var(--success-color); color: white; padding: 2px 6px; border-radius: 10px;">Privacy First</span>
            </h3>
            <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">
                Run AI models locally on your own hardware. No data ever leaves your machine.
            </p>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                <!-- Ollama -->
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">Ollama Configuration</label>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                        <input
                            type="text"
                            id="ollama-url"
                            placeholder="http://localhost:11434"
                            style="flex: 2; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 12px;"
                        />
                        <select id="ollama-model-select" style="flex: 1; padding: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 12px; display: none;">
                        </select>
                        <input
                            type="text"
                            id="ollama-model"
                            placeholder="qwen:latest"
                            style="flex: 1; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 12px;"
                        />
                        <button class="test-local-btn" data-provider="ollama" style="padding: 8px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 12px;">
                            🧪 Test
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 5px;">
                        <button id="refresh-models-btn" style="font-size: 10px; background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); padding: 2px 8px; border-radius: 4px; cursor: pointer;">🔄 Refresh Model List</button>
                        <button id="pull-vision-btn" style="font-size: 10px; background: transparent; border: 1px solid var(--success-color); color: var(--success-color); padding: 2px 8px; border-radius: 4px; cursor: pointer;">📥 Update Vision (Llama 3.2)</button>
                    </div>
                    <div id="ollama-status" style="margin-top: 4px; font-size: 10px;"></div>
                </div>

                <!-- LM Studio -->
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">LM Studio URL</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            id="lmstudio-url"
                            placeholder="http://localhost:1234"
                            style="flex: 1; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 12px;"
                        />
                        <button class="test-local-btn" data-provider="lmstudio" style="padding: 8px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 12px;">
                            🧪 Test
                        </button>
                    </div>
                    <div id="lmstudio-status" style="margin-top: 4px; font-size: 10px;"></div>
                </div>

                <!-- LocalAI -->
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">LocalAI URL</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            id="localai-url"
                            placeholder="http://localhost:8080"
                            style="flex: 1; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 12px;"
                        />
                        <button class="test-local-btn" data-provider="localai" style="padding: 8px 15px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 12px;">
                            🧪 Test
                        </button>
                    </div>
                    <div id="localai-status" style="margin-top: 4px; font-size: 10px;"></div>
                </div>
            </div>
        </div>

        <!-- Save Button -->
        <div style="margin-top: 30px; display: flex; align-items: center; gap: 15px;">
            <button
                id="save-ai-settings-btn"
                style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
            >
                💾 Save AI Configuration
            </button>
            <span id="ai-save-status" style="font-size: 13px;"></span>
        </div>

        <!-- Educational Footer -->
        <div style="margin-top: 30px; padding: 15px; background: var(--bg-tertiary); border-radius: 8px; font-size: 11px;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px; display: flex; align-items: center; gap: 5px;">💡 Pro Tip: Free AI Access</h4>
            <p style="margin: 0; color: var(--text-secondary); line-height: 1.5;">
                <strong>Gemini</strong> offers a generous free tier for Flash models. 
                <strong>OpenRouter</strong> provides access to many free models (like Llama 3) with a single key.
                <strong>Hugging Face</strong> offers thousands of open-source models for free.
                If you have a powerful PC, use <strong>Ollama</strong> for 100% free, private local execution.
            </p>
        </div>
    `;

    setupHandlers(container, profile);
    await loadExistingKeys(container, profile);
}

function renderKeyInput(id, label, placeholder, url) {
    return `
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 12px;">
                ${label}
            </label>
            <div style="position: relative;">
                <input
                    type="password"
                    id="${id}-api-key"
                    placeholder="${placeholder}"
                    style="width: 100%; padding: 8px 35px 8px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: monospace; font-size: 11px;"
                />
                <button
                    class="toggle-key-btn"
                    data-target="${id}-api-key"
                    type="button"
                    style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 4px;"
                >👁️</button>
            </div>
            <div style="margin-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 5px;">
                    <button class="test-key-btn" data-provider="${id}" style="padding: 3px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 10px;">🧪 Test</button>
                    <button class="clear-key-btn" data-target="${id}-api-key" style="padding: 3px 8px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 10px;">🗑️ Clear</button>
                </div>
                <a href="${url}" target="_blank" style="font-size: 10px; color: var(--accent-color); text-decoration: none;">Get Key ↗</a>
            </div>
            <div id="${id}-status" style="margin-top: 4px; font-size: 10px;"></div>
        </div>
    `;
}

function setupHandlers(container, profile) {
    // Toggle buttons
    container.querySelectorAll('.toggle-key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = container.querySelector(`#${btn.dataset.target}`);
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '🙈' : '👁️';
        });
    });

    // Clear buttons
    container.querySelectorAll('.clear-key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelector(`#${btn.dataset.target}`).value = '';
            const provider = btn.dataset.target.replace('-api-key', '');
            container.querySelector(`#${provider}-status`).textContent = '';
        });
    });

    // Test buttons
    container.querySelectorAll('.test-key-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const provider = btn.dataset.provider;
            const key = container.querySelector(`#${provider}-api-key`).value;
            const status = container.querySelector(`#${provider}-status`);
            await testKey(provider, key, status, profile, container);
        });
    });

    // Local AI tests
    container.querySelectorAll('.test-local-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const provider = btn.dataset.provider;
            const url = container.querySelector(`#${provider}-url`).value;
            const status = container.querySelector(`#${provider}-status`);
            await testKey(provider, url, status, profile, container);
        });
    });

    // Model management handlers
    container.querySelector('#refresh-models-btn').addEventListener('click', () => refreshOllamaModels(container));
    container.querySelector('#pull-vision-btn').addEventListener('click', () => pullOllamaModel(container, 'llama3.2-vision'));

    // Save button
    container.querySelector('#save-ai-settings-btn').addEventListener('click', () => saveAllSettings(container, profile));
}

async function refreshOllamaModels(container) {
    const url = container.querySelector('#ollama-url').value || 'http://localhost:11434';
    const status = container.querySelector('#ollama-status');
    const select = container.querySelector('#ollama-model-select');
    const input = container.querySelector('#ollama-model');

    status.innerHTML = '<span style="color: var(--text-secondary);">Fetching models...</span>';

    try {
        const response = await fetch(`/api/ollama/models?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (response.ok && data.models) {
            select.innerHTML = data.models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
            select.style.display = 'block';
            input.style.display = 'none';
            
            // Sync input when selection changes
            select.addEventListener('change', () => {
                input.value = select.value;
            });
            
            // Set initial value
            if (input.value && data.models.some(m => m.name === input.value)) {
                select.value = input.value;
            } else {
                input.value = select.value;
            }

            status.innerHTML = `<span style="color: var(--success-color);">✓ Found ${data.models.length} models</span>`;
        } else {
            status.innerHTML = `<span style="color: var(--danger-color);">✗ ${data.error || 'Failed to fetch models'}</span>`;
        }
    } catch (error) {
        status.innerHTML = `<span style="color: var(--danger-color);">✗ Connection error</span>`;
    }
}

async function pullOllamaModel(container, modelName) {
    const url = container.querySelector('#ollama-url').value || 'http://localhost:11434';
    const status = container.querySelector('#ollama-status');

    if (!confirm(`This will pull/update the '${modelName}' model. This may take several minutes depending on your internet speed. Continue?`)) return;

    status.innerHTML = `<span style="color: var(--accent-color);">📥 Downloading ${modelName}... (Please wait)</span>`;

    try {
        const response = await fetch('/api/ollama/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, model: modelName })
        });

        const data = await response.json();
        if (response.ok) {
            status.innerHTML = `<span style="color: var(--success-color);">✓ ${data.message}</span>`;
            await refreshOllamaModels(container);
        } else {
            status.innerHTML = `<span style="color: var(--danger-color);">✗ ${data.error || 'Pull failed'}</span>`;
        }
    } catch (error) {
        status.innerHTML = `<span style="color: var(--danger-color);">✗ Error updating model</span>`;
    }
}

async function testKey(provider, key, statusElement, profile, container) {
    if (!key || key.trim() === '') {
        statusElement.innerHTML = '<span style="color: var(--danger-color);">⚠️ Required</span>';
        return;
    }

    statusElement.innerHTML = '<span style="color: var(--text-secondary);">Testing...</span>';

    try {
        const payload = { provider, api_key: key };
        
        // Add Ollama model if testing Ollama
        if (provider === 'ollama') {
            const model = container.querySelector('#ollama-model').value.trim();
            if (model) payload.ollama_model = model;
        }

        const response = await fetch('/api/test-api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            statusElement.innerHTML = `<span style="color: var(--success-color);">✓ Valid! ${result.model || ''}</span>`;
            // Auto-save on success
            await saveAllSettings(container, profile, true);
        } else {
            statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ ${result.error || 'Failed'}</span>`;
        }
    } catch (error) {
        statusElement.innerHTML = `<span style="color: var(--danger-color);">✗ Connection Error</span>`;
    }
}

async function loadExistingKeys(container, profile) {
    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`);
        if (response.ok) {
            const data = await response.json();
            const providers = [
                'gemini', 'claude', 'openai', 'grok', 'openrouter', 
                'deepseek', 'mistral', 'together', 'huggingface'
            ];

            providers.forEach(p => {
                const key = data[`${p}_api_key`];
                if (key) {
                    const input = container.querySelector(`#${p}-api-key`);
                    if (input) {
                        input.placeholder = `••••••••${key}`;
                        container.querySelector(`#${p}-status`).innerHTML = '<span style="color: var(--success-color);">✓ Configured</span>';
                    }
                }
            });

            if (data.ollama_url) {
                container.querySelector('#ollama-url').value = data.ollama_url;
                if (data.ollama_model) {
                    container.querySelector('#ollama-model').value = data.ollama_model;
                }
                container.querySelector('#ollama-status').innerHTML = '<span style="color: var(--success-color);">✓ Connected</span>';
            }
            if (data.lmstudio_url) {
                container.querySelector('#lmstudio-url').value = data.lmstudio_url;
                container.querySelector('#lmstudio-status').innerHTML = '<span style="color: var(--success-color);">✓ Connected</span>';
            }
            if (data.localai_url) {
                container.querySelector('#localai-url').value = data.localai_url;
                container.querySelector('#localai-status').innerHTML = '<span style="color: var(--success-color);">✓ Connected</span>';
            }

            if (data.preferred_ai_provider) {
                container.querySelector('#preferred-ai-provider').value = data.preferred_ai_provider;
            }
        }
    } catch (error) {
        console.error('Error loading AI settings:', error);
    }
}

async function saveAllSettings(container, profile, silent = false) {
    const status = container.querySelector('#ai-save-status');
    if (!silent) status.innerHTML = '<span style="color: var(--text-secondary);">Saving...</span>';

    const payload = {};
    const providers = [
        'gemini', 'claude', 'openai', 'grok', 'openrouter', 
        'deepseek', 'mistral', 'together', 'huggingface'
    ];

    providers.forEach(p => {
        const val = container.querySelector(`#${p}-api-key`).value.trim();
        if (val) payload[`${p}_api_key`] = val;
    });

    const ollamaUrl = container.querySelector('#ollama-url').value.trim();
    if (ollamaUrl) payload.ollama_url = ollamaUrl;

    const ollamaModel = container.querySelector('#ollama-model').value.trim();
    if (ollamaModel) payload.ollama_model = ollamaModel;

    const lmstudioUrl = container.querySelector('#lmstudio-url').value.trim();
    if (lmstudioUrl) payload.lmstudio_url = lmstudioUrl;

    const localaiUrl = container.querySelector('#localai-url').value.trim();
    if (localaiUrl) payload.localai_url = localaiUrl;

    const preferredProvider = container.querySelector('#preferred-ai-provider').value;
    payload.preferred_ai_provider = preferredProvider;

    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            if (!silent) {
                status.innerHTML = '<span style="color: var(--success-color);">✓ Saved successfully</span>';
                showSuccess('AI configuration saved');
                setTimeout(() => loadExistingKeys(container, profile), 1000);
            }
        } else {
            const err = await response.json();
            if (!silent) {
                status.innerHTML = `<span style="color: var(--danger-color);">✗ ${err.error || 'Failed'}</span>`;
                showError(err.error || 'Failed to save');
            }
        }
    } catch (error) {
        if (!silent) {
            status.innerHTML = `<span style="color: var(--danger-color);">✗ Error</span>`;
            showError('Network error while saving AI settings');
        }
    }
}