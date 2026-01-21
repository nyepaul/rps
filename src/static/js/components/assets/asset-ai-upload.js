/**
 * AI-powered asset upload from screenshot
 */

import { apiClient } from '../../api/client.js';

/**
 * Show AI upload modal
 * @param {object} existingAssets - Current assets to avoid duplicates
 * @param {function} onSuccess - Callback with updated assets
 * @param {object} profile - Current profile (optional, will try to get from store if not provided)
 */
export function showAIUploadModal(existingAssets, onSuccess, profile = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
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
        max-width: 700px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    content.innerHTML = `
        <div style="padding: 30px; border-bottom: 2px solid var(--border-color);">
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">📷 Import from Screenshot</h2>
            <p style="margin: 0; color: var(--text-secondary);">
                Upload or paste a screenshot of your account statements
            </p>
        </div>

        <div style="padding: 30px;">
            <div id="upload-zone" style="border: 3px dashed var(--border-color); border-radius: 12px; padding: 60px 40px; text-align: center; background: var(--bg-primary); cursor: pointer; transition: all 0.3s;">
                <div style="font-size: 64px; margin-bottom: 20px;">📸</div>
                <h3 style="margin-bottom: 10px; font-size: 20px;">Drop Screenshot Here</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    or click to browse • paste from clipboard (Ctrl/Cmd+V)
                </p>
                <input type="file" id="file-input" accept="image/*" hidden>
                <button id="browse-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Choose File
                </button>
            </div>

            <div id="image-preview" style="margin-top: 20px; display: none;">
                <h4 style="margin-bottom: 10px;">Preview:</h4>
                <img id="preview-img" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 8px; border: 1px solid var(--border-color);">
            </div>

            <div id="provider-selection" style="margin-top: 20px; display: none;">
                <h4 style="margin-bottom: 10px;">AI Provider:</h4>
                <div style="display: flex; gap: 10px;">
                    <label style="flex: 1; padding: 15px; background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                        <input type="radio" name="ai-provider" value="gemini" checked>
                        <div>
                            <div style="font-weight: 600;">Gemini</div>
                            <small style="color: var(--text-secondary);">Fast, reliable (Recommended)</small>
                        </div>
                    </label>
                    <label style="flex: 1; padding: 15px; background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                        <input type="radio" name="ai-provider" value="claude">
                        <div>
                            <div style="font-weight: 600;">Claude</div>
                            <small style="color: var(--text-secondary);">High accuracy</small>
                        </div>
                    </label>
                </div>
            </div>

            <div id="processing" style="display: none; text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🤖</div>
                <h3 style="margin-bottom: 10px;">AI is analyzing your screenshot...</h3>
                <p style="color: var(--text-secondary);">This may take a few seconds</p>
                <div style="margin-top: 20px; width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                    <div style="width: 0%; height: 100%; background: var(--accent-color); animation: progress 2s ease-in-out infinite;"></div>
                </div>
            </div>

            <div id="results" style="display: none;">
                <h4 style="margin-bottom: 15px; color: var(--success-color);">✓ Extraction Complete</h4>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Review and edit the extracted assets before adding them to your profile
                </p>
                <div id="extracted-assets" style="display: grid; gap: 15px;"></div>
            </div>

            <div id="error-message" style="display: none; padding: 20px; background: var(--danger-bg); border: 2px solid var(--danger-color); border-radius: 8px; color: var(--danger-color);"></div>
        </div>

        <div style="padding: 20px 30px; border-top: 2px solid var(--border-color); display: flex; justify-content: space-between;">
            <button id="cancel-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                Cancel
            </button>
            <button id="extract-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: none;">
                🤖 Extract Assets
            </button>
            <button id="save-btn" style="padding: 12px 24px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: none;">
                💾 Add Assets
            </button>
        </div>

        <style>
            @keyframes progress {
                0% { width: 0%; }
                50% { width: 70%; }
                100% { width: 100%; }
            }
        </style>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Setup handlers
    let selectedImage = null;
    let extractedAssets = [];

    const uploadZone = content.querySelector('#upload-zone');
    const fileInput = content.querySelector('#file-input');
    const browseBtn = content.querySelector('#browse-btn');
    const imagePreview = content.querySelector('#image-preview');
    const previewImg = content.querySelector('#preview-img');
    const providerSelection = content.querySelector('#provider-selection');
    const extractBtn = content.querySelector('#extract-btn');
    const saveBtn = content.querySelector('#save-btn');
    const cancelBtn = content.querySelector('#cancel-btn');
    const processing = content.querySelector('#processing');
    const results = content.querySelector('#results');
    const errorMessage = content.querySelector('#error-message');

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    });

    // Browse button
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--accent-color)';
        uploadZone.style.background = 'var(--bg-tertiary)';
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--border-color)';
        uploadZone.style.background = 'var(--bg-primary)';
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--border-color)';
        uploadZone.style.background = 'var(--bg-primary)';

        if (e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Click to upload
    uploadZone.addEventListener('click', (e) => {
        if (e.target !== browseBtn) {
            fileInput.click();
        }
    });

    // Paste from clipboard
    document.addEventListener('paste', handlePaste);

    // Extract button
    extractBtn.addEventListener('click', async () => {
        await extractAssets(selectedImage, existingAssets);
    });

    // Save button
    saveBtn.addEventListener('click', () => {
        if (onSuccess) {
            // Merge extracted assets with existing
            const updatedAssets = { ...existingAssets };
            extractedAssets.forEach(asset => {
                const category = asset.category;
                if (!updatedAssets[category]) {
                    updatedAssets[category] = [];
                }
                updatedAssets[category].push(asset.data);
            });
            onSuccess(updatedAssets);
        }
        modal.remove();
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        document.removeEventListener('paste', handlePaste);
        modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.removeEventListener('paste', handlePaste);
            modal.remove();
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showError('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImage = e.target.result;
            previewImg.src = selectedImage;
            imagePreview.style.display = 'block';
            providerSelection.style.display = 'block';
            extractBtn.style.display = 'block';
            uploadZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function handlePaste(e) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                handleFile(file);
                e.preventDefault();
                break;
            }
        }
    }

    async function extractAssets(imageBase64, existingAssets) {
        const provider = content.querySelector('input[name="ai-provider"]:checked').value;

        // Hide UI elements
        imagePreview.style.display = 'none';
        providerSelection.style.display = 'none';
        extractBtn.style.display = 'none';
        errorMessage.style.display = 'none';
        processing.style.display = 'block';

        try {
            // Get profile from parameter or store
            const currentProfile = profile || (await import('../../state/store.js')).store.get('currentProfile');
            if (!currentProfile) {
                throw new Error('No profile selected. Please select a profile first.');
            }

            // Remove data:image prefix if present
            const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

            const response = await apiClient.post('/api/extract-assets', {
                image: base64Data,
                llm_provider: provider,
                existing_assets: flattenAssets(existingAssets),
                profile_name: currentProfile.name
            });

            if (response.status === 'success' && response.assets && response.assets.length > 0) {
                extractedAssets = response.assets.map(asset => categorizeAsset(asset));
                renderExtractedAssets(extractedAssets);
                processing.style.display = 'none';
                results.style.display = 'block';
                saveBtn.style.display = 'block';
            } else {
                throw new Error('No assets found in the image');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            const errorMsg = error.message || 'Failed to extract assets. Please try again.';

            // Check if this is an API key error
            if (errorMsg.includes('API_KEY') || errorMsg.includes('api-keys') || errorMsg.includes('setup-api-keys')) {
                showError(errorMsg + ' Opening API settings...');

                // Open API settings directly
                setTimeout(() => {
                    if (window.app && window.app.openSettings) {
                        window.app.openSettings('api-keys', 'gemini-api-key');
                    }
                }, 800);
            } else {
                showError(errorMsg);
            }

            processing.style.display = 'none';
            imagePreview.style.display = 'block';
            providerSelection.style.display = 'block';
            extractBtn.style.display = 'block';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function flattenAssets(assets) {
        const flat = [];
        for (const [category, items] of Object.entries(assets)) {
            items.forEach(item => {
                flat.push({ ...item, category });
            });
        }
        return flat;
    }

    function categorizeAsset(asset) {
        // Determine category based on asset type or account type
        const type = (asset.type || asset.account || '').toLowerCase();

        if (type.includes('ira') || type.includes('401') || type.includes('403') || type.includes('457')) {
            return { category: 'retirement_accounts', data: asset };
        } else if (type.includes('brokerage') || type.includes('savings') || type.includes('checking')) {
            return { category: 'taxable_accounts', data: asset };
        } else if (type.includes('real estate') || type.includes('property') || type.includes('home')) {
            return { category: 'real_estate', data: asset };
        } else if (type.includes('pension') || type.includes('annuity')) {
            return { category: 'pensions_annuities', data: asset };
        } else {
            return { category: 'other_assets', data: asset };
        }
    }

    function renderExtractedAssets(assets) {
        const container = content.querySelector('#extracted-assets');
        container.innerHTML = assets.map((asset, index) => `
            <div class="extracted-asset" data-index="${index}" style="padding: 20px; background: var(--bg-primary); border: 2px solid var(--success-color); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4 style="margin: 0 0 8px 0;">${asset.data.name || 'Unnamed Asset'}</h4>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">
                            Category: <strong>${getCategoryLabel(asset.category)}</strong>
                        </div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--accent-color);">
                            $${(asset.data.value || 0).toLocaleString()}
                        </div>
                    </div>
                    <button class="remove-asset-btn" data-index="${index}" style="padding: 8px 12px; background: var(--danger-bg); color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer;">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');

        // Setup remove buttons
        container.querySelectorAll('.remove-asset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                extractedAssets.splice(index, 1);
                renderExtractedAssets(extractedAssets);

                if (extractedAssets.length === 0) {
                    results.style.display = 'none';
                    saveBtn.style.display = 'none';
                    showError('No assets to add. Please try again with a different image.');
                }
            });
        });
    }

    function getCategoryLabel(category) {
        const labels = {
            retirement_accounts: 'Retirement Accounts',
            taxable_accounts: 'Taxable Accounts',
            real_estate: 'Real Estate',
            pensions_annuities: 'Pensions & Annuities',
            other_assets: 'Other Assets'
        };
        return labels[category] || category;
    }
}
