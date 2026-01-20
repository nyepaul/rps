/**
 * Welcome tab component with profile management
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { STORAGE_KEYS } from '../../config.js';
import { showLoading, showError, createElement, showSuccess } from '../../utils/dom.js';

export function renderWelcomeTab(container) {
    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; padding: var(--space-3);">
            <h1 style="font-size: 28px; margin-bottom: var(--space-5); text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                RPS
            </h1>

            <!-- Overview Wizard -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: var(--space-4); margin-bottom: var(--space-4); border: 1px solid var(--border-color);">
                <div id="getting-started-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); cursor: pointer; user-select: none;">
                    <h2 style="font-size: 18px; margin: 0;">📚 Getting Started Guide</h2>
                    <button id="toggle-wizard-btn" style="padding: var(--space-1) var(--space-3); background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        Show Guide
                    </button>
                </div>
                <div id="wizard-content" style="display: none;">
                    <div id="wizard-steps"></div>
                    <div style="display: flex; gap: var(--space-3); justify-content: space-between; margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border-color);">
                        <button id="wizard-prev" style="padding: var(--space-2) var(--space-4); background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ← Previous
                        </button>
                        <div id="wizard-dots" style="display: flex; gap: var(--space-2); align-items: center;"></div>
                        <button id="wizard-next" style="padding: var(--space-2) var(--space-4); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Next →
                        </button>
                    </div>
                </div>
            </div>

            <!-- Profiles Section -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: var(--space-4); margin-bottom: var(--space-4); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                    <h2 style="font-size: 20px; margin: 0;">Your Profiles</h2>
                    <button id="create-profile-btn" style="padding: var(--space-1) var(--space-3); background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        + New Profile
                    </button>
                </div>
                <div id="profiles-container">
                    <div style="text-align: center; padding: var(--space-4); color: var(--text-secondary);">
                        Loading profiles...
                    </div>
                </div>
            </div>

            <!-- Features Info -->
            <div style="text-align: center; padding: var(--space-4); background: var(--info-bg); border-radius: 8px;">
                <h3 style="margin-bottom: var(--space-3); font-size: 16px;">What You Can Do</h3>
                <ul style="text-align: left; display: inline-block; margin: 0; font-size: 13px;">
                    <li>Run Monte Carlo simulations with 10,000+ scenarios</li>
                    <li>Optimize Social Security claiming strategies</li>
                    <li>Analyze Roth conversion opportunities</li>
                    <li>Get AI-powered financial recommendations</li>
                    <li>Create multiple "what-if" scenarios</li>
                    <li>Track action items and progress</li>
                </ul>
            </div>
        </div>
    `;

    // Load and display profiles
    loadProfiles(container);

    // Set up create button
    const createBtn = container.querySelector('#create-profile-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => showCreateProfileModal(container));
    }

    // Initialize wizard
    initializeWizard(container);
}

function initializeWizard(container) {
    const wizardSteps = [
        {
            title: "Understanding the Data Model",
            icon: "🏗️",
            content: `
                <h3 style="font-size: 18px; margin-bottom: var(--space-4); color: var(--accent-color);">How RPS Organizes Your Data</h3>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3);">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">👤</div>
                        <div>
                            <strong style="font-size: 16px;">Account</strong>
                            <div style="font-size: 13px; color: var(--text-secondary);">Your login credentials (email + password)</div>
                        </div>
                    </div>
                    <ul style="margin: var(--space-3) 0 0 50px; font-size: 13px; color: var(--text-secondary);">
                        <li>One account per user</li>
                        <li>Linked to your email address</li>
                        <li>Can contain multiple profiles</li>
                    </ul>
                </div>

                <div style="text-align: center; margin: var(--space-3) 0; color: var(--text-secondary); font-size: 24px;">↓</div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3);">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #2ed573 0%, #26d07c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">📋</div>
                        <div>
                            <strong style="font-size: 16px;">Profiles</strong>
                            <div style="font-size: 13px; color: var(--text-secondary);">Different retirement plans (you, spouse, family)</div>
                        </div>
                    </div>
                    <ul style="margin: var(--space-3) 0 0 50px; font-size: 13px; color: var(--text-secondary);">
                        <li>Multiple profiles per account (e.g., "John", "Joint Plan", "Early Retirement")</li>
                        <li>Each profile contains all financial data: assets, income, expenses</li>
                        <li>Profiles are independent and can model different situations</li>
                    </ul>
                </div>

                <div style="text-align: center; margin: var(--space-3) 0; color: var(--text-secondary); font-size: 24px;">↓</div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3);">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3498db 0%, #5faee3 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">🎯</div>
                        <div>
                            <strong style="font-size: 16px;">Scenarios</strong>
                            <div style="font-size: 13px; color: var(--text-secondary);">Monte Carlo simulations for "what-if" analysis</div>
                        </div>
                    </div>
                    <ul style="margin: var(--space-3) 0 0 50px; font-size: 13px; color: var(--text-secondary);">
                        <li>Run multiple scenarios per profile (e.g., "Base Case", "Retire Early", "Conservative")</li>
                        <li>Each scenario runs 10,000+ simulations with different market conditions</li>
                        <li>Compare scenarios side-by-side to make informed decisions</li>
                    </ul>
                </div>
            `
        },
        {
            title: "Security & Encryption",
            icon: "🔒",
            content: `
                <h3 style="font-size: 18px; margin-bottom: var(--space-4); color: var(--success-color);">Your Data is Protected</h3>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <h4 style="font-size: 16px; margin-bottom: var(--space-3);">🔐 Encryption at Rest</h4>
                    <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
                        All profile data is encrypted using <strong>AES-256-GCM</strong> encryption before being stored in the database.
                        Each record has a unique initialization vector (IV), ensuring maximum security even if the database is compromised.
                    </p>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <h4 style="font-size: 16px; margin-bottom: var(--space-3);">🔑 Password Security</h4>
                    <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
                        Passwords are hashed using <strong>bcrypt</strong> with a high work factor. Your password is never stored in plain text
                        and cannot be recovered by anyone, including system administrators.
                    </p>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <h4 style="font-size: 16px; margin-bottom: var(--space-3);">🏠 Local-First Architecture</h4>
                    <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
                        RPS runs on your local machine or private server. Your financial data stays under your control and never
                        leaves your infrastructure unless you explicitly choose to share it.
                    </p>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <h4 style="font-size: 16px; margin-bottom: var(--space-3);">📝 Audit Logging</h4>
                    <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
                        All sensitive operations are logged for compliance and security monitoring. View the audit log in the Admin panel
                        to track who accessed what and when.
                    </p>
                </div>

                <div style="background: var(--warning-bg); padding: var(--space-3); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                    <strong style="font-size: 14px;">⚠️ Important:</strong>
                    <p style="font-size: 13px; margin: var(--space-1) 0 0 0;">
                        Keep your encryption keys and database backups secure. If you lose your encryption key, your data cannot be recovered.
                    </p>
                </div>
            `
        },
        {
            title: "Sample Workflow",
            icon: "✅",
            content: `
                <h3 style="font-size: 18px; margin-bottom: var(--space-4); color: var(--info-color);">Complete Your First Profile</h3>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-3);">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">1</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Create a Profile</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Click "+ New Profile" below. Enter your name, birth date, and target retirement date.
                                This becomes your baseline profile.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-3);">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">2</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Add Your Assets</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Go to <strong>💰 Assets</strong> tab. Add your accounts: checking, savings, 401(k), IRA, Roth,
                                taxable brokerage, and real estate. Include current values and cost basis.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-3);">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">3</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Add Income Streams</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Go to <strong>💰 Income</strong> tab. Add your current salary, Social Security estimates,
                                pension, rental income, and any other income sources with start/end dates.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-3);">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">4</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Plan Your Expenses</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Go to <strong>💵 Expenses</strong> tab. Set your current expenses and future (retirement) expenses.
                                Include housing, utilities, food, healthcare, travel, and discretionary spending.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-3);">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">5</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Run Your First Scenario</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Go to <strong>Analysis</strong> tab. Click "Run Complete Analysis" to run a Monte Carlo simulation
                                with 10,000 scenarios. Review your success rate and wealth projection.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-3);">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">6</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Explore "What-If" Scenarios</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Create additional scenarios: "Retire Early", "Conservative Portfolio", "Higher Spending".
                                Compare them side-by-side in the <strong>Compare Scenarios</strong> tab.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-4); border-radius: 8px;">
                    <div style="display: flex; align-items: start; gap: var(--space-3);">
                        <div style="min-width: 30px; height: 30px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">7</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 15px;">Get AI Recommendations</strong>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                                Go to <strong>AI Advisor</strong> tab. Get personalized recommendations for Social Security timing,
                                Roth conversions, tax optimization, and more. Convert recommendations to action items.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--success-bg); padding: var(--space-3); border-radius: 6px; border-left: 4px solid var(--success-color); margin-top: var(--space-4);">
                    <strong style="font-size: 14px;">💡 Pro Tip:</strong>
                    <p style="font-size: 13px; margin: var(--space-1) 0 0 0;">
                        Start with a simple baseline profile, then create variations to explore different strategies.
                        The more scenarios you test, the more confident you'll be in your retirement plan.
                    </p>
                </div>
            `
        }
    ];

    let currentStep = 0;
    const wizardContent = container.querySelector('#wizard-content');
    const wizardStepsContainer = container.querySelector('#wizard-steps');
    const toggleBtn = container.querySelector('#toggle-wizard-btn');
    const prevBtn = container.querySelector('#wizard-prev');
    const nextBtn = container.querySelector('#wizard-next');
    const dotsContainer = container.querySelector('#wizard-dots');

    function renderStep() {
        const step = wizardSteps[currentStep];
        wizardStepsContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 48px; margin-bottom: 10px;">${step.icon}</div>
                <h3 style="font-size: 20px; margin: 0;">${step.title}</h3>
            </div>
            <div style="font-size: 14px; line-height: 1.6;">
                ${step.content}
            </div>
        `;

        // Update navigation
        prevBtn.disabled = currentStep === 0;
        prevBtn.style.opacity = currentStep === 0 ? '0.5' : '1';
        prevBtn.style.cursor = currentStep === 0 ? 'not-allowed' : 'pointer';

        if (currentStep === wizardSteps.length - 1) {
            nextBtn.textContent = '✓ Done';
            nextBtn.style.background = 'var(--success-color)';
        } else {
            nextBtn.textContent = 'Next →';
            nextBtn.style.background = 'var(--accent-color)';
        }

        // Update dots
        dotsContainer.innerHTML = wizardSteps.map((_, idx) => `
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${idx === currentStep ? 'var(--accent-color)' : 'var(--border-color)'}; transition: all 0.3s;"></div>
        `).join('');
    }

    const toggleWizard = () => {
        const isVisible = wizardContent.style.display !== 'none';
        wizardContent.style.display = isVisible ? 'none' : 'block';
        toggleBtn.textContent = isVisible ? 'Show Guide' : 'Hide Guide';
    };

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double trigger from parent
        toggleWizard();
    });

    // Make the entire header row clickable
    const headerRow = container.querySelector('#getting-started-header');
    headerRow.addEventListener('click', toggleWizard);

    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            renderStep();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentStep < wizardSteps.length - 1) {
            currentStep++;
            renderStep();
        } else {
            // Close wizard on done
            wizardContent.style.display = 'none';
            toggleBtn.textContent = 'Show Guide';
        }
    });

    renderStep();
}

async function loadProfiles(container) {
    const profilesContainer = container.querySelector('#profiles-container');
    const defaultProfileName = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);

    try {
        const data = await profilesAPI.list();
        const profiles = data.profiles || [];

        if (profiles.length === 0) {
            profilesContainer.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <p>No profiles yet. Create your first profile to get started!</p>
                </div>
            `;
            return;
        }

        profilesContainer.innerHTML = profiles.map(profile => {
            const isDefault = profile.name === defaultProfileName;
            return `
                <div class="profile-item" data-profile="${profile.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--bg-primary); border: 2px solid ${isDefault ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <strong style="font-size: 16px;">${profile.name}</strong>
                            ${isDefault ? '<span style="font-size: 11px; padding: 2px 8px; background: var(--accent-color); color: white; border-radius: 10px;">DEFAULT</span>' : ''}
                        </div>
                        <small style="color: var(--text-secondary);">Updated: ${new Date(profile.updated_at).toLocaleDateString()}</small>
                    </div>
                    <div style="display: flex; gap: 8px;" onclick="event.stopPropagation()">
                        <button class="set-default-btn" data-profile="${profile.name}" title="${isDefault ? 'Current default' : 'Set as default'}" style="padding: 6px 10px; background: ${isDefault ? 'var(--text-secondary)' : 'var(--bg-tertiary)'}; color: ${isDefault ? 'white' : 'var(--text-primary)'}; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            ${isDefault ? '★ Default' : '☆ Set Default'}
                        </button>
                        <button class="edit-profile-btn" data-profile="${profile.name}" title="Edit profile" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 4px; cursor: pointer;">
                            ✏️
                        </button>
                        <button class="delete-profile-btn" data-profile="${profile.name}" title="Delete profile" style="padding: 6px 10px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event handlers
        setupProfileHandlers(container, profiles);

    } catch (error) {
        profilesContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger-color);">
                Error loading profiles: ${error.message}
            </div>
        `;
    }
}

function setupProfileHandlers(container, profiles) {
    // Click to load profile
    container.querySelectorAll('.profile-item').forEach(item => {
        item.addEventListener('click', async () => {
            const profileName = item.dataset.profile;
            await loadProfile(profileName);
        });

        // Hover effects
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 4px 12px var(--shadow)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateY(0)';
            item.style.boxShadow = 'none';
        });
    });

    // Set default buttons
    container.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileName = btn.dataset.profile;
            localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileName);
            showSuccess(`"${profileName}" set as default profile`);
            loadProfiles(container); // Refresh display
        });
    });

    // Edit buttons
    container.querySelectorAll('.edit-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileName = btn.dataset.profile;
            const profile = profiles.find(p => p.name === profileName);
            if (profile) {
                showEditProfileModal(container, profile);
            }
        });
    });

    // Delete buttons
    container.querySelectorAll('.delete-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const profileName = btn.dataset.profile;
            
            if (confirm(`Delete profile "${profileName}"? This cannot be undone.`)) {
                try {
                    await profilesAPI.delete(profileName);
                    // Clear default if this was it
                    if (localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE) === profileName) {
                        localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
                    }
                    // Clear current profile if this was it
                    const currentProfile = store.get('currentProfile');
                    if (currentProfile?.name === profileName) {
                        store.setState({ currentProfile: null });
                    }
                    showSuccess(`Profile "${profileName}" deleted`);
                    loadProfiles(container);
                } catch (error) {
                    showError(`Error deleting profile: ${error.message}`);
                }
            }
        });
    });
}

function showCreateProfileModal(container) {
    const modal = createModal(`
        <h2 style="margin-bottom: 20px;">Create New Profile</h2>
        <form id="profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Profile Name *</label>
                <input type="text" name="name" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Birth Date</label>
                <input type="date" name="birth_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Target Retirement Date</label>
                <input type="date" name="retirement_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="set_default">
                    <span>Set as default profile</span>
                </label>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Create Profile
                </button>
            </div>
        </form>
    `);

    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const profileData = {
            name: formData.get('name'),
            birth_date: formData.get('birth_date') || null,
            retirement_date: formData.get('retirement_date') || null,
            data: {},
        };

        try {
            const result = await profilesAPI.create(profileData);

            // Set as default if checked
            if (formData.get('set_default')) {
                localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileData.name);
            }

            store.setState({ currentProfile: result.profile });
            modal.remove();
            window.app.showTab('profile');
        } catch (error) {
            showError(`Error creating profile: ${error.message}`);
        }
    });
}

function showEditProfileModal(container, profile) {
    const modal = createModal(`
        <h2 style="margin-bottom: 20px;">Edit Profile</h2>
        <form id="profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Profile Name *</label>
                <input type="text" name="name" value="${profile.name}" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Birth Date</label>
                <input type="date" name="birth_date" value="${profile.birth_date || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Target Retirement Date</label>
                <input type="date" name="retirement_date" value="${profile.retirement_date || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Save Changes
                </button>
            </div>
        </form>
    `);

    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const updates = {
            name: formData.get('name'),
            birth_date: formData.get('birth_date') || null,
            retirement_date: formData.get('retirement_date') || null,
        };

        try {
            const result = await profilesAPI.update(profile.name, updates);

            // Update default profile name if it changed
            const defaultProfile = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);
            if (defaultProfile === profile.name && updates.name !== profile.name) {
                localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, updates.name);
            }

            // Update current profile if this was it
            const currentProfile = store.get('currentProfile');
            if (currentProfile?.name === profile.name) {
                store.setState({ currentProfile: result.profile });
            }

            modal.remove();
            showSuccess('Profile updated');
            loadProfiles(container);
        } catch (error) {
            showError(`Error updating profile: ${error.message}`);
        }
    });
}

function createModal(content) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--bg-secondary);
        padding: 30px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
    `;
    dialog.innerHTML = content;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    return modal;
}

async function loadProfile(profileName) {
    try {
        const data = await profilesAPI.get(profileName);
        store.setState({ currentProfile: data.profile });
        window.app.showTab('dashboard');
    } catch (error) {
        showError(`Error loading profile: ${error.message}`);
    }
}

// Export function to load default profile on app start
export async function loadDefaultProfile() {
    const defaultProfileName = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);
    if (!defaultProfileName) return false;

    try {
        const data = await profilesAPI.get(defaultProfileName);
        store.setState({ currentProfile: data.profile });
        return true;
    } catch (error) {
        // Default profile no longer exists, clear it
        localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
        return false;
    }
}
