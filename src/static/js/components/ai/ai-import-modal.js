/**
 * Reusable AI Import Modal component
 * Handles file uploads and AI extraction for assets, income, and expenses
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Show AI Import Modal
 * @param {string} type - 'assets', 'income', or 'expenses'
 * @param {string} profileName - Current profile name
 * @param {function} onComplete - Callback with extracted data
 */
export function showAIImportModal(type, profileName, onComplete) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';

    const typeLabels = {
        'assets': 'Assets & Accounts',
        'income': 'Income Streams',
        'expenses': 'Expenses'
    };

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Import ${typeLabels[type]}</h2>
                <button id="close-ai-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>

            <div id="ai-upload-step">
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    Upload an image, PDF, or CSV file. AI will extract the relevant data for you.
                </p>

                <div id="drop-zone" style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--bg-primary);">
                    <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
                    <div style="font-weight: 600; margin-bottom: 5px;">Click or Drag & Drop File</div>
                    <div style="font-size: 12px; color: var(--text-light);">Images, PDF, or CSV</div>
                    <input type="file" id="ai-file-input" accept="image/*,.pdf,.csv,application/pdf,text/csv" style="display: none;">
                </div>

                <div style="margin-top: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">AI Provider</label>
                    <select id="ai-provider-select" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        <option value="gemini">Google Gemini (Recommended for Vision)</option>
                        <option value="claude">Anthropic Claude</option>
                        <option value="openai">OpenAI (GPT-4o)</option>
                        <option value="ollama">Local Ollama (Uses model from settings)</option>
                    </select>
                </div>
            </div>

            <div id="ai-processing-step" style="display: none; text-align: center; padding: 40px 20px;">
                <div class="spinner" style="margin: 0 auto 20px auto; width: 40px; height: 40px; border-width: 4px;"></div>
                <div style="font-weight: 600; margin-bottom: 10px;">Analyzing image...</div>
                <p style="color: var(--text-secondary); font-size: 13px;">This usually takes 5-10 seconds.</p>
            </div>

            <div id="ai-preview-step" style="display: none;">
                <h3 style="font-size: 16px; margin-bottom: 12px;">Extracted Data</h3>
                <div id="ai-extracted-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px; border: 1px solid var(--border-color); border-radius: 6px;">
                    <!-- Data items will be listed here -->
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="ai-cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button id="ai-confirm-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Import All Items</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const dropZone = modal.querySelector('#drop-zone');
    const fileInput = modal.querySelector('#ai-file-input');
    const uploadStep = modal.querySelector('#ai-upload-step');
    const processingStep = modal.querySelector('#ai-processing-step');
    const previewStep = modal.querySelector('#ai-preview-step');
    const providerSelect = modal.querySelector('#ai-provider-select');
    let extractedData = null;

    // Pre-select preferred provider if available
    const initProvider = async () => {
        try {
            const response = await apiClient.get(`/api/profiles/${encodeURIComponent(profileName)}/api-keys`);
            if (response && response.preferred_ai_provider) {
                providerSelect.value = response.preferred_ai_provider;
            } else if (response && response.ollama_url && !response.gemini_api_key) {
                // If Ollama is configured but Gemini isn't, default to Ollama
                providerSelect.value = 'ollama';
            }
        } catch (error) {
            console.warn('Could not load preferred AI provider, defaulting to Gemini', error);
        }
    };
    initProvider();

    // Handle close
    const closeModal = () => modal.remove();
    modal.querySelector('#close-ai-modal').addEventListener('click', closeModal);
    modal.querySelector('#ai-cancel-btn').addEventListener('click', closeModal);

    // File selection
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-color)';
        dropZone.style.background = 'var(--info-bg)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'var(--bg-primary)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    });

    async function processFile(file) {
        // Accept images, PDFs, and CSVs
        const validTypes = ['image/', 'application/pdf', 'text/csv'];
        const validExtensions = ['.pdf', '.csv'];
        const isValidType = validTypes.some(t => file.type.startsWith(t)) ||
                           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
            showError('Please upload an image, PDF, or CSV file.');
            return;
        }

        const provider = modal.querySelector('#ai-provider-select').value;

        // Show processing state
        uploadStep.style.display = 'none';
        processingStep.style.display = 'block';
        const progressMessage = processingStep.querySelector('p');
        const progressBarContainer = document.createElement('div');
        progressBarContainer.style.width = '100%';
        progressBarContainer.style.background = 'var(--bg-tertiary)';
        progressBarContainer.style.borderRadius = '8px';
        progressBarContainer.style.height = '10px';
        progressBarContainer.style.marginTop = '15px';
        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.background = 'var(--accent-color)';
        progressBar.style.borderRadius = '8px';
        progressBar.style.height = '100%';
        progressBar.style.transition = 'width 0.1s ease-in-out';
        progressBarContainer.appendChild(progressBar);
        processingStep.appendChild(progressBarContainer);


        try {
            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result.split(',')[1];
                const mimeType = file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'application/pdf');

                try {
                    const endpoint = `/api/extract-${type.replace('_accounts', '')}`;
                    
                    const updateProgress = (data) => {
                        if (data.progress !== undefined) {
                            progressBar.style.width = `${data.progress}%`;
                            progressMessage.textContent = data.message || `Processing... ${data.progress}%`;
                        } else if (data.message) {
                            progressMessage.textContent = data.message;
                        }
                    };

                    // Add a safety timeout for long-running PDF extractions (Cloudflare limit is ~100s)
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('TIMEOUT')), 95000)
                    );

                    const requestPromise = apiClient.streamRequest(endpoint, {
                        image: base64Data,
                        mime_type: mimeType,
                        file_name: file.name,
                        llm_provider: provider,
                        profile_name: profileName
                    }, updateProgress);

                    const finalResponse = await Promise.race([requestPromise, timeoutPromise]);

                    if (finalResponse && finalResponse.error) {
                        showError(finalResponse.error);
                        uploadStep.style.display = 'block';
                        processingStep.style.display = 'none';
                        progressBarContainer.remove();
                        return;
                    }

                    extractedData = finalResponse[type] || finalResponse.income || finalResponse.expenses || [];
                    
                    if (extractedData.length === 0) {
                        showError('AI could not find any items in this image. Please try a different screenshot or add manually.');
                        uploadStep.style.display = 'block';
                        processingStep.style.display = 'none';
                        progressBarContainer.remove();
                        return;
                    }

                    showPreview();
                } catch (error) {
                    console.error('AI Extraction error:', error);
                    if (error.message === 'TIMEOUT') {
                        showError('The document is very large and taking longer than expected. It is still processing in the background. Please try again in 2 minutes.');
                    } else {
                        showError(error.message || 'AI extraction failed.');
                    }
                    uploadStep.style.display = 'block';
                    processingStep.style.display = 'none';
                    progressBarContainer.remove();
                }
            };
        } catch (error) {
            showError('Failed to read file.');
            uploadStep.style.display = 'block';
            processingStep.style.display = 'none';
            progressBarContainer.remove();
        }
    }

    function showPreview() {
        processingStep.style.display = 'none';
        previewStep.style.display = 'block';
        
        const list = modal.querySelector('#ai-extracted-list');
        
        // Defensive check: ensure extractedData is an array
        if (!Array.isArray(extractedData)) {
            console.error('Expected array for extractedData, got:', typeof extractedData, extractedData);
            extractedData = [];
        }

        list.innerHTML = extractedData.map((item, index) => `
            <div style="padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary);">
                <div>
                    <div style="font-weight: 600; font-size: 13px;">${item.name}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        ${item.type || item.category || ''} | ${item.frequency || ''}
                    </div>
                </div>
                <div style="font-weight: 700; font-family: monospace;">
                    $${(item.value || item.amount || 0).toLocaleString()}
                </div>
            </div>
        `).join('');
    }

    // Handle final confirm
    modal.querySelector('#ai-confirm-btn').addEventListener('click', () => {
        onComplete(extractedData);
        closeModal();
        showSuccess(`Successfully imported ${extractedData.length} items!`);
    });
}
