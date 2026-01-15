/**
 * Rebalancing analysis component
 */

import { analysisAPI } from '../../api/analysis.js';
import { formatCurrency, formatPercent } from '../../utils/formatters.js';

export const RebalancingTab = {
    render() {
        return `
            <div class="rebalancing-container">
                <h3>Asset Allocation & Rebalancing</h3>
                <p>Analyze your current aggregate allocation across all accounts and get tax-efficient rebalancing suggestions.</p>
                
                <div class="card bg-light mb-4">
                    <div class="card-body">
                        <h5>Target Allocation</h5>
                        <div class="row">
                            <div class="col-md-4">
                                <label>Stocks (%)</label>
                                <input type="number" id="target-stocks" class="form-control" value="60" min="0" max="100">
                            </div>
                            <div class="col-md-4">
                                <label>Bonds (%)</label>
                                <input type="number" id="target-bonds" class="form-control" value="40" min="0" max="100">
                            </div>
                            <div class="col-md-4">
                                <label>Cash (%)</label>
                                <input type="number" id="target-cash" class="form-control" value="0" min="0" max="100">
                            </div>
                        </div>
                        <button id="run-rebalancing" class="btn btn-primary mt-3">Analyze Allocation</button>
                    </div>
                </div>

                <div id="rebalancing-results" class="mt-4" style="display: none;">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h5>Current vs. Target</h5>
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Asset Class</th>
                                                <th>Current</th>
                                                <th>Target</th>
                                                <th>Diff ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody id="allocation-table-body">
                                            <!-- Filled dynamically -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h5>Recommendations</h5>
                                    <ul id="rebalancing-recommendations" class="list-group list-group-flush">
                                        <!-- Filled dynamically -->
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    init(profileName) {
        const runBtn = document.getElementById('run-rebalancing');
        if (!runBtn) return;

        runBtn.addEventListener('click', async () => {
            const targetStocks = parseFloat(document.getElementById('target-stocks').value) / 100;
            const targetBonds = parseFloat(document.getElementById('target-bonds').value) / 100;
            const targetCash = parseFloat(document.getElementById('target-cash').value) / 100;

            const targetAllocation = {
                stocks: targetStocks,
                bonds: targetBonds,
                cash: targetCash
            };

            try {
                runBtn.disabled = true;
                runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Analyzing...';
                
                const response = await analysisAPI.analyzeRebalancing(profileName, targetAllocation);
                this.displayResults(response);
                
                document.getElementById('rebalancing-results').style.display = 'block';
            } catch (error) {
                console.error('Rebalancing analysis failed:', error);
                alert('Analysis failed. Please check your asset data.');
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = 'Analyze Allocation';
            }
        });
    },

    displayResults(data) {
        const tableBody = document.getElementById('allocation-table-body');
        const recsList = document.getElementById('rebalancing-recommendations');
        
        const { current_allocation, target_allocation, imbalance_dollars } = data;
        
        // Update table
        tableBody.innerHTML = `
            <tr>
                <td>Stocks</td>
                <td>${formatPercent(current_allocation.stocks)}</td>
                <td>${formatPercent(target_allocation.stocks)}</td>
                <td class="${imbalance_dollars.stocks < 0 ? 'text-danger' : 'text-success'}">
                    ${formatCurrency(imbalance_dollars.stocks, 0)}
                </td>
            </tr>
            <tr>
                <td>Bonds</td>
                <td>${formatPercent(current_allocation.bonds)}</td>
                <td>${formatPercent(target_allocation.bonds)}</td>
                <td class="${imbalance_dollars.bonds < 0 ? 'text-danger' : 'text-success'}">
                    ${formatCurrency(imbalance_dollars.bonds, 0)}
                </td>
            </tr>
            <tr>
                <td>Cash</td>
                <td>${formatPercent(current_allocation.cash)}</td>
                <td>${formatPercent(target_allocation.cash)}</td>
                <td class="${imbalance_dollars.cash < 0 ? 'text-danger' : 'text-success'}">
                    ${formatCurrency(imbalance_dollars.cash, 0)}
                </td>
            </tr>
            <tr class="table-info">
                <td><strong>Total Portfolio</strong></td>
                <td colspan="3"><strong>${formatCurrency(data.total_value, 0)}</strong></td>
            </tr>
        `;

        // Update recommendations
        recsList.innerHTML = data.recommendations.map(rec => `
            <li class="list-group-item">${rec}</li>
        `).join('');
    }
};
