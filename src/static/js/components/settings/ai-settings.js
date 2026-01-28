/**
 * AI Settings Component - Simplified and clean
 */

import { store } from '../../state/store.js';
import { showSuccess, showError } from '../../utils/dom.js';

let showAllProviders = false;

/**
 * Provider configurations
 */
const PROVIDERS = {
    recommended: [
        { id: 'gemini', name: '✨ Google Gemini', placeholder: 'AIzaSy...', url: 'https://aistudio.google.com/app/apikey', desc: 'Free tier, fast, recommended' },
        { id: 'claude', name: '🤖 Anthropic Claude', placeholder: 'sk-ant-...', url: 'https://console.anthropic.com/', desc: 'Best reasoning, thoughtful' },
        { id: 'openai', name: '🧠 OpenAI GPT-4', placeholder: 'sk-...', url: 'https://platform.openai.com/api-keys', desc: 'Industry standard, reliable' }
    ],
    budget: [
        { id: 'openrouter', name: '🌐 OpenRouter', placeholder: 'sk-or-...', url: 'https://openrouter.ai/keys', desc: 'Pay per use, many models' },
        { id: 'deepseek', name: '🐳 DeepSeek', placeholder: 'sk-...', url: 'https://platform.deepseek.com/', desc: 'Low cost, good quality' },
        { id: 'grok', name: '🚀 xAI Grok', placeholder: 'xai-...', url: 'https://console.x.ai/', desc: 'Fast, conversational' }
    ],
    local: [
        { id: 'lmstudio', name: '💻 LM Studio', placeholder: 'http://localhost:1234', isUrl: true, desc: '100% private, your hardware' },
        { id: 'localai', name: '🤖 LocalAI', placeholder: 'http://localhost:8080', isUrl: true, desc: 'Self-hosted, open source' }
    ],
    more: [
        { id: 'mistral', name: '🌀 Mistral AI', placeholder: '...', url: 'https://console.mistral.ai/', desc: 'European, multilingual' },
        { id: 'together', name: '🤝 Together AI', placeholder: '...', url: 'https://api.together.xyz/', desc: 'Fast inference' },
        { id: 'huggingface', name: '🤗 Hugging Face', placeholder: 'hf_...', url: 'https://huggingface.co/settings/tokens', desc: 'Open models' },
        { id: 'zhipu', name: '🇨🇳 Zhipu AI', placeholder: '...', url: 'https://open.bigmodel.cn/', desc: 'Chinese models' }
    ]
};

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
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px; color: white;">
            <h3 style="margin: 0 0 8px 0; font-size: 18px;">🧠 AI Provider Configuration</h3>
            <p style="margin: 0; font-size: 13px; opacity: 0.9;">
                Configure AI providers for smart retirement advice and analysis. Keys are encrypted with AES-256-GCM.
            </p>
        </div>

        <!-- Status Summary -->
        <div id="status-summary" style="margin-bottom: 20px;"></div>

        <!-- Recommended Providers -->
        <div style="margin-bottom: 25px;">
            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                ⭐ Recommended Providers
                <span style="font-size: 11px; font-weight: normal; color: var(--text-secondary);">(Start here)</span>
            </h3>
            <div id="recommended-providers"></div>
        </div>

        <!-- Budget Options -->
        <div style="margin-bottom: 25px;">
            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--accent-color);">💰 Budget Options</h3>
            <div id="budget-providers"></div>
        </div>

        <!-- Local AI -->
        <div style="margin-bottom: 25px;">
            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                🏠 Privacy First (100% Local)
                <span style="font-size: 10px; font-weight: normal; background: var(--success-color); color: white; padding: 2px 6px; border-radius: 10px;">No Data Leaves Your PC</span>
            </h3>
            <div id="local-providers"></div>
        </div>

        <!-- Show More Toggle -->
        <div id="more-providers-section" style="margin-bottom: 25px; display: none;">
            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--accent-color);">🌍 More Providers</h3>
            <div id="more-providers"></div>
        </div>

        <button id="toggle-more-providers" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text-primary); margin-bottom: 25px;">
            <span id="toggle-more-text">Show More Providers ▼</span>
        </button>

        <!-- Default Provider Selection -->
        <div style="padding: 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 25px;">
            <h3 style="font-size: 14px; margin: 0 0 8px 0; color: var(--accent-color);">🎯 Default AI Provider</h3>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">
                Select which provider handles your advisor chat and analysis by default.
            </p>
            <select id="preferred-ai-provider" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px;">
                <option value="gemini">✨ Google Gemini</option>
                <option value="claude">🤖 Anthropic Claude</option>
                <option value="openai">🧠 OpenAI GPT-4</option>
                <option value="grok">🚀 xAI Grok</option>
                <option value="openrouter">🌐 OpenRouter</option>
                <option value="deepseek">🐳 DeepSeek</option>
                <option value="mistral">🌀 Mistral AI</option>
                <option value="together">🤝 Together AI</option>
                <option value="huggingface">🤗 Hugging Face</option>
                <option value="zhipu">🇨🇳 Zhipu AI</option>
                <option value="lmstudio">💻 LM Studio</option>
                <option value="localai">🤖 LocalAI</option>
            </select>
        </div>

        <!-- Save Button -->
        <div style="display: flex; align-items: center; gap: 15px;">
            <button
                id="save-ai-settings-btn"
                style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
            >
                💾 Save Configuration
            </button>
            <span id="ai-save-status" style="font-size: 13px;"></span>
        </div>
    `;

    // Render provider sections
    renderProviderSection(container, 'recommended-providers', PROVIDERS.recommended);
    renderProviderSection(container, 'budget-providers', PROVIDERS.budget);
    renderProviderSection(container, 'local-providers', PROVIDERS.local);
    renderProviderSection(container, 'more-providers', PROVIDERS.more);

    // Setup handlers
    setupHandlers(container, profile);

    // Load existing keys
    await loadExistingKeys(container, profile);

    // Update status summary
    updateStatusSummary(container, profile);
}

function renderProviderSection(container, elementId, providers) {
    const section = container.querySelector(`#${elementId}`);
    section.innerHTML = providers.map(p => renderProviderCard(p)).join('');
}

function renderProviderCard(provider) {
    const fieldType = provider.isUrl ? 'url' : 'password';
    const fieldId = provider.isUrl ? `${provider.id}-url` : `${provider.id}-api-key`;

    return `
        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 12px;" data-provider="${provider.id}">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div>
                    <div style="font-weight: 600; font-size: 13px; margin-bottom: 3px;">${provider.name}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${provider.desc}</div>
                </div>
                <div id="${provider.id}-status-badge" style="font-size: 20px; display: none;" title="Status indicator"></div>
            </div>

            <!-- Configured Status (shown when key exists) -->
            <div id="${provider.id}-configured" style="display: none; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(46, 204, 113, 0.1); border: 1px solid var(--success-color); border-radius: 6px;">
                    <span style="color: var(--success-color); font-size: 12px; flex: 1;">
                        ✓ Configured: ••••••••<span id="${provider.id}-masked"></span>
                    </span>
                    <button class="verify-btn" data-provider="${provider.id}" style="padding: 4px 10px; background: var(--success-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Test</button>
                    <button class="delete-btn" data-provider="${provider.id}" style="padding: 4px 10px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 11px;">Delete</button>
                </div>
            </div>

            <!-- Input Section -->
            <div id="${provider.id}-input-section">
                <div style="position: relative; margin-bottom: 8px;">
                    <input
                        type="${fieldType}"
                        id="${fieldId}"
                        placeholder="${provider.placeholder}"
                        style="width: 100%; padding: 8px 35px 8px 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-family: monospace; font-size: 12px;"
                    />
                    ${!provider.isUrl ? `<button class="toggle-visibility-btn" data-target="${fieldId}" type="button" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 4px; font-size: 16px;">👁️</button>` : ''}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="test-key-btn" data-provider="${provider.id}" style="padding: 4px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;">🧪 Test Connection</button>
                    ${provider.url ? `<a href="${provider.url}" target="_blank" style="font-size: 11px; color: var(--accent-color); text-decoration: none;">Get Key ↗</a>` : ''}
                </div>
                <div id="${provider.id}-test-status" style="margin-top: 6px; font-size: 11px;"></div>
            </div>
        </div>
    `;
}

function setupHandlers(container, profile) {
    // Toggle visibility buttons
    container.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = container.querySelector(`#${btn.dataset.target}`);
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '🙈' : '👁️';
        });
    });

    // Test connection buttons
    container.querySelectorAll('.test-key-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const provider = btn.dataset.provider;
            await testNewKey(provider, container, profile);
        });
    });

    // Verify stored key buttons
    container.querySelectorAll('.verify-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const provider = btn.dataset.provider;
            await testStoredKey(provider, container, profile);
        });
    });

    // Delete key buttons
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const provider = btn.dataset.provider;
            if (confirm(`Delete the stored ${provider.toUpperCase()} API key?`)) {
                await deleteKey(provider, container, profile);
            }
        });
    });

    // Toggle more providers
    container.querySelector('#toggle-more-providers').addEventListener('click', () => {
        showAllProviders = !showAllProviders;
        const section = container.querySelector('#more-providers-section');
        const toggleText = container.querySelector('#toggle-more-text');
        section.style.display = showAllProviders ? 'block' : 'none';
        toggleText.textContent = showAllProviders ? 'Show Less ▲' : 'Show More Providers ▼';
    });

    // Save button
    container.querySelector('#save-ai-settings-btn').addEventListener('click', () => saveAllSettings(container, profile));
}

async function testNewKey(provider, container, profile) {
    const isUrl = ['lmstudio', 'localai'].includes(provider);
    const inputId = isUrl ? `${provider}-url` : `${provider}-api-key`;
    const input = container.querySelector(`#${inputId}`);
    const statusEl = container.querySelector(`#${provider}-test-status`);
    const value = input.value.trim();

    if (!value) {
        statusEl.innerHTML = '<span style="color: var(--warning-color);">⚠ Please enter a value first</span>';
        return;
    }

    statusEl.innerHTML = '<span style="color: var(--text-secondary);">⏳ Testing...</span>';

    try {
        const response = await fetch('/api/test-api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, api_key: value })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            statusEl.innerHTML = `<span style="color: var(--success-color);">✓ Valid! ${result.model || ''} - Save to store this key</span>`;
        } else {
            statusEl.innerHTML = `<span style="color: var(--danger-color);">✗ ${result.error || 'Connection failed'}</span>`;
        }
    } catch (error) {
        statusEl.innerHTML = `<span style="color: var(--danger-color);">✗ Network error</span>`;
    }
}

async function testStoredKey(provider, container, profile) {
    const btn = container.querySelector(`.verify-btn[data-provider="${provider}"]`);
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/test-stored-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            btn.textContent = '✓';
            btn.style.background = 'var(--success-color)';
            showSuccess(`${provider} connection verified`);
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } else {
            btn.textContent = '✗';
            btn.style.background = 'var(--danger-color)';
            showError(result.error || 'Verification failed');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = 'var(--success-color)';
            }, 3000);
        }
    } catch (error) {
        btn.textContent = '✗';
        showError('Network error');
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    } finally {
        btn.disabled = false;
    }
}

async function deleteKey(provider, container, profile) {
    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/delete-api-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });

        if (response.ok) {
            // Hide configured section, show input section
            container.querySelector(`#${provider}-configured`).style.display = 'none';
            container.querySelector(`#${provider}-input-section`).style.display = 'block';
            container.querySelector(`#${provider}-status-badge`).style.display = 'none';

            // Clear input
            const isUrl = ['lmstudio', 'localai'].includes(provider);
            const inputId = isUrl ? `${provider}-url` : `${provider}-api-key`;
            container.querySelector(`#${inputId}`).value = '';

            showSuccess(`${provider.toUpperCase()} key deleted`);
            updateStatusSummary(container, profile);
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to delete key');
        }
    } catch (error) {
        showError('Network error while deleting key');
    }
}

async function loadExistingKeys(container, profile) {
    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`);
        if (!response.ok) return;

        const data = await response.json();
        const allProviders = [...PROVIDERS.recommended, ...PROVIDERS.budget, ...PROVIDERS.local, ...PROVIDERS.more];

        allProviders.forEach(p => {
            const isUrl = p.isUrl;
            const keyName = isUrl ? `${p.id}_url` : `${p.id}_api_key`;
            const value = data[keyName];

            if (value) {
                // Show configured section
                const configuredEl = container.querySelector(`#${p.id}-configured`);
                const inputSection = container.querySelector(`#${p.id}-input-section`);
                const statusBadge = container.querySelector(`#${p.id}-status-badge`);
                const maskedSpan = container.querySelector(`#${p.id}-masked`);

                if (configuredEl && inputSection) {
                    configuredEl.style.display = 'block';
                    inputSection.style.display = 'none';
                    statusBadge.style.display = 'block';
                    statusBadge.textContent = '✓';
                    statusBadge.style.color = 'var(--success-color)';

                    if (maskedSpan) {
                        maskedSpan.textContent = isUrl ? '' : value; // Show last 4 for keys, nothing for URLs
                    }
                }
            }
        });

        // Set preferred provider
        if (data.preferred_ai_provider) {
            container.querySelector('#preferred-ai-provider').value = data.preferred_ai_provider;
        }

    } catch (error) {
        console.error('Error loading AI settings:', error);
    }
}

async function saveAllSettings(container, profile) {
    const statusEl = container.querySelector('#ai-save-status');
    statusEl.innerHTML = '<span style="color: var(--text-secondary);">💾 Saving...</span>';

    const payload = {};
    const allProviders = [...PROVIDERS.recommended, ...PROVIDERS.budget, ...PROVIDERS.local, ...PROVIDERS.more];

    allProviders.forEach(p => {
        const isUrl = p.isUrl;
        const inputId = isUrl ? `${p.id}-url` : `${p.id}-api-key`;
        const input = container.querySelector(`#${inputId}`);
        const value = input?.value.trim();

        if (value && !value.includes('•')) {
            const keyName = isUrl ? `${p.id}_url` : `${p.id}_api_key`;
            payload[keyName] = value;
        }
    });

    const preferredProvider = container.querySelector('#preferred-ai-provider').value;
    payload.preferred_ai_provider = preferredProvider;

    try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            statusEl.innerHTML = '<span style="color: var(--success-color);">✓ Saved successfully</span>';
            showSuccess('AI configuration saved and encrypted');

            // Reload to show updated status
            setTimeout(() => {
                renderAPIKeysSettings(container);
            }, 1000);
        } else {
            const err = await response.json();
            statusEl.innerHTML = `<span style="color: var(--danger-color);">✗ ${err.error || 'Failed'}</span>`;
            showError(err.error || 'Failed to save');
        }
    } catch (error) {
        statusEl.innerHTML = `<span style="color: var(--danger-color);">✗ Network error</span>`;
        showError('Network error while saving');
    }
}

function updateStatusSummary(container, profile) {
    const summaryEl = container.querySelector('#status-summary');
    if (!summaryEl) return;

    fetch(`/api/profiles/${encodeURIComponent(profile.name)}/api-keys`)
        .then(r => r.json())
        .then(data => {
            const configured = [];
            const allProviders = [...PROVIDERS.recommended, ...PROVIDERS.budget, ...PROVIDERS.local, ...PROVIDERS.more];

            allProviders.forEach(p => {
                const keyName = p.isUrl ? `${p.id}_url` : `${p.id}_api_key`;
                if (data[keyName]) {
                    configured.push(p.name);
                }
            });

            if (configured.length === 0) {
                summaryEl.innerHTML = `
                    <div style="padding: 12px; background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; border-radius: 4px;">
                        <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">⚠ No AI providers configured</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Add at least one provider to enable AI features</div>
                    </div>
                `;
            } else {
                const preferredName = PROVIDERS.recommended.concat(PROVIDERS.budget, PROVIDERS.local, PROVIDERS.more)
                    .find(p => p.id === data.preferred_ai_provider)?.name || data.preferred_ai_provider;

                summaryEl.innerHTML = `
                    <div style="padding: 12px; background: rgba(46, 204, 113, 0.1); border-left: 4px solid var(--success-color); border-radius: 4px;">
                        <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">✓ ${configured.length} provider${configured.length > 1 ? 's' : ''} configured</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Active: ${preferredName || 'Not set'}</div>
                    </div>
                `;
            }
        })
        .catch(() => {
            summaryEl.innerHTML = '';
        });
}
