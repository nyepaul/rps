/**
 * Transaction Import Modal
 * 4-step flow: Upload → Analysis → Reconciliation → Confirmation
 */

import { importTransactions, reconcileTransactions, createMergeAction, createAddNewAction, createIgnoreAction, createAddExpenseAction } from '../../api/transactions.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/formatters.js';

/**
 * Show Transaction Import Modal
 * @param {string} profileName - Current profile name
 * @param {Array} currentIncomeStreams - Existing income streams
 * @param {function} onComplete - Callback when import completes
 */
export function showTransactionImportModal(profileName, currentIncomeStreams, onComplete) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto;">
            <!-- Step 1: Upload -->
            <div id="upload-step">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Import Bank Transactions</h2>
                    <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>

                <div style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-color, #2196F3); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 20px;">🔒</span>
                        <div style="flex: 1; font-size: 13px; line-height: 1.5;">
                            <strong>Privacy-First Design:</strong> Your CSV is processed in-memory only. We detect recurring patterns (salary, rent, subscriptions) but never store individual transactions. PII (account numbers, IDs) is stripped automatically.
                        </div>
                    </div>
                </div>

                <div id="drop-zone" style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--bg-primary); margin-bottom: 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                    <div style="font-weight: 600; margin-bottom: 5px;">Drop CSV file or click to browse</div>
                    <div style="font-size: 12px; color: var(--text-light);">Bank transaction history (18+ months recommended, max 5MB)</div>
                    <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display: none;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer;">
                        <input type="checkbox" id="privacy-consent" style="width: 16px; height: 16px;">
                        <span>I understand my CSV will be analyzed for patterns (no transactions stored)</span>
                    </label>
                </div>

                <button id="analyze-btn" disabled style="width: 100%; padding: 12px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; opacity: 0.5;">
                    Analyze Transactions
                </button>

                <div style="margin-top: 20px; font-size: 12px; color: var(--text-secondary);">
                    <strong>Supported formats:</strong> Chase, Bank of America, Amex, Wells Fargo, generic CSVs<br>
                    <strong>Required columns:</strong> Date, Description, Amount (or Debit/Credit)
                </div>
            </div>

            <!-- Step 2: Analysis (Progress) -->
            <div id="analysis-step" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Analyzing Transactions</h2>
                </div>

                <div style="text-align: center; padding: 40px 20px;">
                    <div class="spinner" style="margin: 0 auto 20px auto; width: 40px; height: 40px; border-width: 4px;"></div>
                    <div id="progress-message" style="font-weight: 600; margin-bottom: 10px;">Starting analysis...</div>
                    <div style="background: var(--bg-tertiary); border-radius: 10px; height: 8px; margin: 20px auto; max-width: 400px; overflow: hidden;">
                        <div id="progress-bar" style="height: 100%; background: var(--accent-color); width: 0%; transition: width 0.3s;"></div>
                    </div>
                    <div id="progress-percent" style="color: var(--text-secondary); font-size: 13px;">0%</div>
                </div>
            </div>

            <!-- Step 3: Reconciliation -->
            <div id="reconciliation-step" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h2 style="margin: 0;">Review Detected Patterns</h2>
                        <p style="color: var(--text-secondary); margin: 5px 0 0 0; font-size: 13px;" id="summary-text">Loading...</p>
                    </div>
                    <button id="close-reconciliation" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>

                <!-- Tabs -->
                <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); overflow-x: auto; flex-wrap: wrap;">
                    <button class="recon-tab active" data-tab="income-conflicts" style="padding: 10px 16px; background: none; border: none; cursor: pointer; font-weight: 600; font-size: 13px; border-bottom: 2px solid var(--accent-color); margin-bottom: -2px; white-space: nowrap;">
                        Income Conflicts <span class="tab-badge" id="income-conflicts-badge">0</span>
                    </button>
                    <button class="recon-tab" data-tab="income-new" style="padding: 10px 16px; background: none; border: none; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-secondary); white-space: nowrap;">
                        New Income <span class="tab-badge" id="income-new-badge">0</span>
                    </button>
                    <button class="recon-tab" data-tab="income-matches" style="padding: 10px 16px; background: none; border: none; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-secondary); white-space: nowrap;">
                        Matches <span class="tab-badge" id="income-matches-badge">0</span>
                    </button>
                    <button class="recon-tab" data-tab="expenses" style="padding: 10px 16px; background: none; border: none; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-secondary); white-space: nowrap;">
                        Expenses <span class="tab-badge" id="expenses-badge">0</span>
                    </button>
                </div>

                <!-- Tab Content -->
                <div id="tab-content" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                    <!-- Content populated by JS -->
                </div>

                <!-- Actions Footer -->
                <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        <span id="selected-count">0</span> actions selected
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="cancel-recon-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                            Cancel
                        </button>
                        <button id="apply-changes-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Apply Changes
                        </button>
                    </div>
                </div>
            </div>

            <!-- Step 4: Confirmation -->
            <div id="confirmation-step" style="display: none;">
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                    <h2 style="margin-bottom: 10px;">Import Complete!</h2>
                    <p id="confirmation-message" style="color: var(--text-secondary); margin-bottom: 30px;">
                        Successfully imported patterns from your CSV.
                    </p>
                    <button id="done-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Done
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // State
    let selectedFile = null;
    let analysisResult = null;
    let userActions = [];

    // Elements
    const uploadStep = modal.querySelector('#upload-step');
    const analysisStep = modal.querySelector('#analysis-step');
    const reconciliationStep = modal.querySelector('#reconciliation-step');
    const confirmationStep = modal.querySelector('#confirmation-step');
    const dropZone = modal.querySelector('#drop-zone');
    const fileInput = modal.querySelector('#csv-file-input');
    const privacyConsent = modal.querySelector('#privacy-consent');
    const analyzeBtn = modal.querySelector('#analyze-btn');
    const progressBar = modal.querySelector('#progress-bar');
    const progressMessage = modal.querySelector('#progress-message');
    const progressPercent = modal.querySelector('#progress-percent');

    // Close handlers
    modal.querySelector('#close-modal')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#close-reconciliation')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#cancel-recon-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#done-btn')?.addEventListener('click', () => {
        modal.remove();
        if (onComplete) onComplete();
    });

    // File selection
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-color)';
        dropZone.style.background = 'var(--bg-secondary)';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'var(--bg-primary)';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'var(--bg-primary)';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.name.endsWith('.csv')) {
            showError('Please select a CSV file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showError('File too large (max 5MB)');
            return;
        }

        selectedFile = file;
        dropZone.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 10px;">📄</div>
            <div style="font-weight: 600; margin-bottom: 5px;">${file.name}</div>
            <div style="font-size: 12px; color: var(--text-light);">${(file.size / 1024).toFixed(1)} KB</div>
        `;

        updateAnalyzeButton();
    }

    privacyConsent.addEventListener('change', updateAnalyzeButton);

    function updateAnalyzeButton() {
        const canAnalyze = selectedFile && privacyConsent.checked;
        analyzeBtn.disabled = !canAnalyze;
        analyzeBtn.style.opacity = canAnalyze ? '1' : '0.5';
        analyzeBtn.style.cursor = canAnalyze ? 'pointer' : 'not-allowed';
    }

    // Analyze button
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // Switch to analysis step
        uploadStep.style.display = 'none';
        analysisStep.style.display = 'block';

        try {
            const result = await importTransactions(
                profileName,
                selectedFile,
                (status, progress, message, data) => {
                    progressBar.style.width = `${progress}%`;
                    progressPercent.textContent = `${progress}%`;
                    progressMessage.textContent = message;

                    if (status === 'complete' && data) {
                        analysisResult = data;
                    }
                }
            );

            // Move to reconciliation step
            setTimeout(() => {
                analysisStep.style.display = 'none';
                reconciliationStep.style.display = 'block';
                renderReconciliation(result, currentIncomeStreams);
            }, 500);

        } catch (error) {
            console.error('Import error:', error);
            showError(error.message || 'Failed to import transactions');
            modal.remove();
        }
    });

    // Reconciliation logic
    function renderReconciliation(data, currentStreams) {
        const { detected_income, detected_expenses, reconciliation } = data;
        const { matches, new_detected, manual_only, summary } = reconciliation;

        // Update summary
        const summaryText = modal.querySelector('#summary-text');
        summaryText.textContent = `Found ${data.transaction_count} transactions • ${summary.total_matches} matches, ${summary.conflicts} conflicts, ${summary.new_detected} new`;

        // Update badge counts
        modal.querySelector('#income-conflicts-badge').textContent = summary.conflicts;
        modal.querySelector('#income-new-badge').textContent = summary.new_detected;
        modal.querySelector('#income-matches-badge').textContent = summary.exact_matches;

        const totalExpenses = Object.values(detected_expenses).reduce((sum, arr) => sum + arr.length, 0);
        modal.querySelector('#expenses-badge').textContent = totalExpenses;

        // Tab switching
        const tabs = modal.querySelectorAll('.recon-tab');
        const tabContent = modal.querySelector('#tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.borderBottom = 'none';
                    t.style.color = 'var(--text-secondary)';
                });
                tab.classList.add('active');
                tab.style.borderBottom = '2px solid var(--accent-color)';
                tab.style.color = 'var(--text-primary)';

                const tabName = tab.dataset.tab;
                renderTabContent(tabName, { matches, new_detected, manual_only, detected_expenses, currentStreams });
            });
        });

        // Render initial tab (conflicts)
        renderTabContent('income-conflicts', { matches, new_detected, manual_only, detected_expenses, currentStreams });

        // Apply changes button
        modal.querySelector('#apply-changes-btn').addEventListener('click', async () => {
            if (userActions.length === 0) {
                showError('No changes selected');
                return;
            }

            try {
                const result = await reconcileTransactions(profileName, userActions);

                // Show confirmation
                reconciliationStep.style.display = 'none';
                confirmationStep.style.display = 'block';

                const confirmMsg = modal.querySelector('#confirmation-message');
                confirmMsg.textContent = `Added ${result.income_added} income streams and ${result.expenses_added} expenses.`;

            } catch (error) {
                showError(error.message || 'Failed to apply changes');
            }
        });
    }

    function renderTabContent(tabName, { matches, new_detected, manual_only, detected_expenses, currentStreams }) {
        const tabContent = modal.querySelector('#tab-content');

        if (tabName === 'income-conflicts') {
            const conflicts = matches.filter(m => m.match_type !== 'match');

            if (conflicts.length === 0) {
                tabContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                        <div>No conflicts found</div>
                    </div>
                `;
                return;
            }

            tabContent.innerHTML = conflicts.map((match, idx) => `
                <div class="recon-item" style="border: 1px solid var(--border-color); border-left: 4px solid ${match.match_type === 'major_conflict' ? '#f59e0b' : '#fbbf24'}; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: var(--bg-secondary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">
                                ${match.specified_name}
                                <span style="display: inline-block; padding: 2px 8px; background: ${match.match_type === 'major_conflict' ? '#f59e0b' : '#fbbf24'}; color: white; border-radius: 4px; font-size: 11px; margin-left: 8px;">
                                    ${match.variance_percent.toFixed(1)}% variance
                                </span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                Your entry: ${formatCurrency(match.specified_amount)} ${match.specified_frequency} •
                                Detected: ${formatCurrency(match.detected_amount)} ${match.detected_frequency}
                            </div>
                        </div>
                        <select class="action-select" data-type="conflict" data-index="${match.specified_index}" data-match-idx="${idx}" style="padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); font-size: 12px;">
                            <option value="">Choose action...</option>
                            <option value="merge">Merge (use detected)</option>
                            <option value="keep">Keep manual</option>
                            <option value="ignore">Ignore</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Confidence: ${(match.confidence * 100).toFixed(0)}% • From: ${match.detected_name}
                    </div>
                </div>
            `).join('');

        } else if (tabName === 'income-new') {
            if (new_detected.length === 0) {
                tabContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                        <div>No new income streams detected</div>
                    </div>
                `;
                return;
            }

            tabContent.innerHTML = new_detected.map((stream, idx) => `
                <div class="recon-item" style="border: 1px solid var(--border-color); border-left: 4px solid #3b82f6; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: var(--bg-secondary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">
                                ${stream.name}
                                <span style="display: inline-block; padding: 2px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; margin-left: 8px;">
                                    New
                                </span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                ${formatCurrency(stream.amount)} ${stream.frequency} • ${stream.transaction_count} transactions
                            </div>
                        </div>
                        <select class="action-select" data-type="new" data-index="${idx}" style="padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); font-size: 12px;">
                            <option value="add" selected>Add as new</option>
                            <option value="ignore">Ignore</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Confidence: ${(stream.confidence * 100).toFixed(0)}% • Period: ${stream.first_seen} to ${stream.last_seen}
                    </div>
                </div>
            `).join('');

        } else if (tabName === 'income-matches') {
            const exactMatches = matches.filter(m => m.match_type === 'match');

            if (exactMatches.length === 0) {
                tabContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 10px;">🔍</div>
                        <div>No exact matches found</div>
                    </div>
                `;
                return;
            }

            tabContent.innerHTML = exactMatches.map(match => `
                <div class="recon-item" style="border: 1px solid var(--border-color); border-left: 4px solid #10b981; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: var(--bg-secondary);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">
                                ${match.specified_name}
                                <span style="display: inline-block; padding: 2px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 11px; margin-left: 8px;">
                                    ✓ Match
                                </span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                ${formatCurrency(match.specified_amount)} ${match.specified_frequency}
                            </div>
                        </div>
                        <div style="font-size: 12px; color: var(--success-color);">
                            ${match.variance_percent.toFixed(1)}% variance
                        </div>
                    </div>
                </div>
            `).join('');

        } else if (tabName === 'expenses') {
            const allExpenses = Object.entries(detected_expenses).flatMap(([category, expenses]) =>
                expenses.map(e => ({ ...e, category }))
            );

            if (allExpenses.length === 0) {
                tabContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 10px;">💳</div>
                        <div>No expense patterns detected</div>
                    </div>
                `;
                return;
            }

            tabContent.innerHTML = allExpenses.map((expense, idx) => `
                <div class="recon-item" style="border: 1px solid var(--border-color); border-left: 4px solid #8b5cf6; border-radius: 6px; padding: 15px; margin-bottom: 10px; background: var(--bg-secondary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">
                                ${expense.name}
                                <span style="display: inline-block; padding: 2px 8px; background: #8b5cf6; color: white; border-radius: 4px; font-size: 11px; margin-left: 8px;">
                                    ${expense.category}
                                </span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                ${formatCurrency(expense.amount)} ${expense.frequency} • ${expense.transaction_count} transactions
                            </div>
                        </div>
                        <select class="action-select" data-type="expense" data-category="${expense.category}" data-index="${idx}" style="padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); font-size: 12px;">
                            <option value="add" selected>Add to budget</option>
                            <option value="ignore">Ignore</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Confidence: ${(expense.confidence * 100).toFixed(0)}%
                    </div>
                </div>
            `).join('');

            // Store expenses data for later
            tabContent.dataset.expensesData = JSON.stringify(allExpenses);
        }

        // Add event listeners to all action selects
        const selects = tabContent.querySelectorAll('.action-select');
        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                updateUserActions();
            });
        });

        updateUserActions();
    }

    function updateUserActions() {
        userActions = [];

        // Collect all selected actions
        const selects = modal.querySelectorAll('.action-select');
        selects.forEach(select => {
            const value = select.value;
            if (!value || value === 'keep') return;

            const type = select.dataset.type;
            const index = parseInt(select.dataset.index);

            if (type === 'conflict') {
                const matchIdx = parseInt(select.dataset.matchIdx);
                const match = analysisResult.reconciliation.matches.filter(m => m.match_type !== 'match')[matchIdx];

                if (value === 'merge' && match) {
                    userActions.push(createMergeAction(match.specified_index, {
                        amount: match.detected_amount,
                        frequency: match.detected_frequency,
                        confidence: match.confidence,
                        detected_from: selectedFile.name,
                        variance: 0,
                        first_seen: analysisResult.date_range.start,
                        last_seen: analysisResult.date_range.end
                    }));
                } else if (value === 'ignore' && match) {
                    userActions.push(createIgnoreAction({ name: match.detected_name }));
                }

            } else if (type === 'new') {
                const stream = analysisResult.reconciliation.new_detected[index];
                if (value === 'add' && stream) {
                    userActions.push(createAddNewAction({
                        name: stream.name,
                        amount: stream.amount,
                        frequency: stream.frequency,
                        confidence: stream.confidence,
                        variance: stream.variance,
                        first_seen: stream.first_seen,
                        last_seen: stream.last_seen,
                        detected_from: selectedFile.name
                    }));
                } else if (value === 'ignore' && stream) {
                    userActions.push(createIgnoreAction(stream));
                }

            } else if (type === 'expense') {
                const category = select.dataset.category;
                const tabContent = select.closest('#tab-content');
                const expensesData = JSON.parse(tabContent.dataset.expensesData || '[]');
                const expense = expensesData[index];

                if (value === 'add' && expense) {
                    userActions.push(createAddExpenseAction(category, {
                        name: expense.name,
                        amount: expense.amount,
                        frequency: expense.frequency,
                        confidence: expense.confidence,
                        variance: expense.variance,
                        transaction_count: expense.transaction_count,
                        first_seen: expense.first_seen,
                        last_seen: expense.last_seen
                    }));
                } else if (value === 'ignore' && expense) {
                    userActions.push(createIgnoreAction(expense));
                }
            }
        });

        // Update selected count
        modal.querySelector('#selected-count').textContent = userActions.length;
    }
}
