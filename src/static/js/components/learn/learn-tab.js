/**
 * Learn tab component - Educational content
 */

export function renderLearnTab(container) {
    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Learning Hub</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Master retirement planning concepts and strategies
            </p>

            <div style="display: grid; gap: 20px;">
                <!-- Retirement Basics -->
                <div class="learn-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px;">📚 Retirement Basics</h2>
                    <div class="article-grid">
                        <div class="article-card">
                            <h3>Understanding the 4% Rule</h3>
                            <p>Learn about the classic withdrawal strategy and its limitations in modern retirement planning.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Types of Retirement Accounts</h3>
                            <p>401(k), IRA, Roth IRA, and more. Understand the differences and tax implications.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Social Security Basics</h3>
                            <p>How Social Security works, when to claim, and strategies to maximize your benefits.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                    </div>
                </div>

                <!-- Investment Strategies -->
                <div class="learn-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px;">📈 Investment Strategies</h2>
                    <div class="article-grid">
                        <div class="article-card">
                            <h3>Asset Allocation</h3>
                            <p>Balance risk and return with the right mix of stocks, bonds, and other investments.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Rebalancing Your Portfolio</h3>
                            <p>Maintain your target allocation and manage risk as markets fluctuate.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Dollar Cost Averaging</h3>
                            <p>Reduce market timing risk by investing consistently over time.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                    </div>
                </div>

                <!-- Tax Optimization -->
                <div class="learn-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px;">💰 Tax Optimization</h2>
                    <div class="article-grid">
                        <div class="article-card">
                            <h3>Roth Conversions</h3>
                            <p>Convert traditional retirement accounts to Roth for tax-free growth and withdrawals.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Tax-Efficient Withdrawal Strategies</h3>
                            <p>Minimize taxes by withdrawing from accounts in the optimal order.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Required Minimum Distributions (RMDs)</h3>
                            <p>Understand RMD rules and strategies to manage them effectively.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                    </div>
                </div>

                <!-- Advanced Topics -->
                <div class="learn-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px;">🎯 Advanced Topics</h2>
                    <div class="article-grid">
                        <div class="article-card">
                            <h3>Monte Carlo Simulation</h3>
                            <p>Understand how probabilistic analysis helps plan for uncertainty in retirement.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Sequence of Returns Risk</h3>
                            <p>Why the order of investment returns matters more than average returns in retirement.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                        <div class="article-card">
                            <h3>Healthcare Planning</h3>
                            <p>Plan for Medicare, supplemental insurance, and long-term care costs.</p>
                            <button class="learn-btn">Read More</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .learn-section {
                background: var(--bg-secondary);
                padding: 30px;
                border-radius: 12px;
            }
            .article-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
            }
            .article-card {
                background: var(--bg-primary);
                padding: 20px;
                border-radius: 8px;
                border: 2px solid var(--border-color);
                transition: all 0.2s;
            }
            .article-card:hover {
                border-color: var(--accent-color);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--shadow);
            }
            .article-card h3 {
                font-size: 18px;
                margin-bottom: 10px;
                color: var(--text-primary);
            }
            .article-card p {
                color: var(--text-secondary);
                margin-bottom: 15px;
                line-height: 1.5;
                font-size: 14px;
            }
            .learn-btn {
                padding: 8px 16px;
                background: var(--accent-color);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .learn-btn:hover {
                background: var(--accent-hover);
            }
        </style>
    `;

    // Add event listeners to buttons
    document.querySelectorAll('.learn-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.article-card');
            const title = card.querySelector('h3').textContent;
            alert(`Article: "${title}"\n\nDetailed content coming soon!`);
        });
    });
}
