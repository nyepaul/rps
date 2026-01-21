/**
 * Welcome tab component with profile management
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { STORAGE_KEYS } from '../../config.js';
import { showLoading, showError, createElement, showSuccess } from '../../utils/dom.js';

export function renderWelcomeTab(container) {
    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; padding: var(--space-2);">
            <!-- Overview Wizard -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: var(--space-3); margin-bottom: var(--space-2); border: 1px solid var(--border-color);">
                <div id="getting-started-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); cursor: pointer; user-select: none;">
                    <h2 style="font-size: 16px; margin: 0;">📚 Getting Started Guide</h2>
                    <button id="toggle-wizard-btn" style="padding: 4px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        Hide Guide
                    </button>
                </div>
                <div id="wizard-content" style="display: block;">
                    <div id="wizard-steps"></div>
                    <div style="display: flex; gap: var(--space-2); justify-content: space-between; margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-color);">
                        <button id="wizard-prev" style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            ← Previous
                        </button>
                        <div id="wizard-dots" style="display: flex; gap: 6px; align-items: center;"></div>
                        <button id="wizard-next" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            Next →
                        </button>
                    </div>
                </div>
            </div>

            <!-- Profiles Section -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: var(--space-3); margin-bottom: var(--space-2); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
                    <h2 style="font-size: 16px; margin: 0;">Your Profiles</h2>
                    <button id="create-profile-btn" style="padding: 4px 10px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        + New Profile
                    </button>
                </div>
                <div id="profiles-container">
                    <div style="text-align: center; padding: var(--space-3); color: var(--text-secondary);">
                        Loading profiles...
                    </div>
                </div>
            </div>

            <!-- Features Info -->
            <div style="text-align: center; padding: var(--space-3); background: var(--info-bg); border-radius: 8px;">
                <h3 style="margin-bottom: var(--space-2); font-size: 14px;">What You Can Do</h3>
                <ul style="text-align: left; display: inline-block; margin: 0; font-size: 12px; line-height: 1.5;">
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
            title: "Getting Started",
            icon: "🚀",
            content: `
                <h3 style="font-size: 15px; margin-bottom: var(--space-2); color: var(--info-color);">High-Level Process Overview</h3>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: start; gap: var(--space-2);">
                        <div style="min-width: 26px; height: 26px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">1</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 13px;">Create Your Profile</strong>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
                                Click "+ New Profile" below to create your retirement planning profile. Enter your name,
                                birth date, and target retirement date to establish your baseline.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: start; gap: var(--space-2);">
                        <div style="min-width: 26px; height: 26px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">2</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 13px;">Add Assets, Expenses & Income</strong>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
                                Build your financial picture by adding all your assets (401k, IRA, brokerage accounts, real estate),
                                income sources (salary, Social Security, pensions), and expenses (current and projected retirement spending).
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: start; gap: var(--space-2);">
                        <div style="min-width: 26px; height: 26px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">3</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 13px;">Review Cash Flow, Withdrawals & Tax Strategy</strong>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
                                Examine your projected cash flow throughout retirement. Configure your withdrawal strategy
                                (which accounts to draw from first) and explore tax optimization opportunities including Roth conversions.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: start; gap: var(--space-2);">
                        <div style="min-width: 26px; height: 26px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">4</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 13px;">Run Analysis & Compare Scenarios</strong>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
                                Execute Monte Carlo simulations (10,000+ scenarios) to test your plan under different economic conditions.
                                Save multiple scenarios ("Base Case", "Early Retirement", "Conservative") and compare them side-by-side
                                to make informed decisions.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: start; gap: var(--space-2);">
                        <div style="min-width: 26px; height: 26px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">5</div>
                        <div style="flex: 1;">
                            <strong style="font-size: 13px;">Generate & Review Action Items</strong>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">
                                Get AI-powered recommendations for optimizing your retirement plan. Convert insights into trackable
                                action items with priorities, due dates, and completion tracking. Monitor progress toward your financial goals.
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--success-bg); padding: var(--space-2); border-radius: 6px; border-left: 4px solid var(--success-color); margin-top: var(--space-2);">
                    <strong style="font-size: 13px;">💡 Getting Started Tip:</strong>
                    <p style="font-size: 12px; margin: 4px 0 0 0;">
                        Begin with a complete baseline profile, then create alternative scenarios to explore different strategies.
                        The iterative process of testing various economic conditions builds confidence in your retirement plan.
                    </p>
                </div>
            `
        },
        {
            title: "Understanding the Data Model",
            icon: "🏗️",
            content: `
                <h3 style="font-size: 15px; margin-bottom: var(--space-2); color: var(--accent-color);">How the App Organizes Your Data</h3>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">👤</div>
                        <div>
                            <strong style="font-size: 14px;">Account</strong>
                            <div style="font-size: 12px; color: var(--text-secondary);">Your login credentials (email + password)</div>
                        </div>
                    </div>
                    <ul style="margin: var(--space-1) 0 0 42px; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                        <li>One account per user</li>
                        <li>Linked to your email address</li>
                        <li>Can contain multiple profiles</li>
                    </ul>
                </div>

                <div style="text-align: center; margin: var(--space-1) 0; color: var(--text-secondary); font-size: 18px;">↓</div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #2ed573 0%, #26d07c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">📋</div>
                        <div>
                            <strong style="font-size: 14px;">Profiles</strong>
                            <div style="font-size: 12px; color: var(--text-secondary);">Different retirement plans (you, spouse, family)</div>
                        </div>
                    </div>
                    <ul style="margin: var(--space-1) 0 0 42px; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                        <li>Multiple profiles per account (e.g., "John", "Joint Plan", "Early Retirement")</li>
                        <li>Each profile contains all financial data: assets, income, expenses</li>
                        <li>Profiles are independent and can model different situations</li>
                    </ul>
                </div>

                <div style="text-align: center; margin: var(--space-1) 0; color: var(--text-secondary); font-size: 18px;">↓</div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px;">
                    <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #3498db 0%, #5faee3 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">🎯</div>
                        <div>
                            <strong style="font-size: 14px;">Scenarios</strong>
                            <div style="font-size: 12px; color: var(--text-secondary);">Monte Carlo simulations for "what-if" analysis</div>
                        </div>
                    </div>
                    <ul style="margin: var(--space-1) 0 0 42px; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
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
                <h3 style="font-size: 15px; margin-bottom: var(--space-2); color: var(--success-color);">Your Data is Protected</h3>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <h4 style="font-size: 13px; margin-bottom: var(--space-1);">🔐 Encryption at Rest</h4>
                    <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                        All profile data is encrypted using <strong>AES-256-GCM</strong> encryption before being stored in the database.
                        Each record has a unique initialization vector (IV), ensuring maximum security even if the database is compromised.
                    </p>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <h4 style="font-size: 13px; margin-bottom: var(--space-1);">🔑 Password Security</h4>
                    <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                        Passwords are hashed using <strong>bcrypt</strong> with a high work factor. Your password is never stored in plain text
                        and cannot be recovered by anyone, including system administrators.
                    </p>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <h4 style="font-size: 13px; margin-bottom: var(--space-1);">🏠 Local-First Architecture</h4>
                    <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                        The app runs on your local machine or private server. Your financial data stays under your control and never
                        leaves your infrastructure unless you explicitly choose to share it.
                    </p>
                </div>

                <div style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; margin-bottom: var(--space-2);">
                    <h4 style="font-size: 13px; margin-bottom: var(--space-1);">📝 Audit Logging</h4>
                    <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                        All sensitive operations are logged for compliance and security monitoring. View the audit log in the Admin panel
                        to track who accessed what and when.
                    </p>
                </div>

                <div style="background: var(--warning-bg); padding: var(--space-2); border-radius: 6px; border-left: 4px solid var(--warning-color);">
                    <strong style="font-size: 13px;">⚠️ Important:</strong>
                    <p style="font-size: 12px; margin: 4px 0 0 0;">
                        Keep your encryption keys and database backups secure. If you lose your encryption key, your data cannot be recovered.
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
            <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 32px; margin-bottom: 6px;">${step.icon}</div>
                <h3 style="font-size: 16px; margin: 0;">${step.title}</h3>
            </div>
            <div style="font-size: 13px; line-height: 1.5;">
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
                <div class="profile-item" data-profile="${profile.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-primary); border: 2px solid ${isDefault ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 14px;">${profile.name}</strong>
                            ${isDefault ? '<span style="font-size: 10px; padding: 2px 6px; background: var(--accent-color); color: white; border-radius: 8px;">DEFAULT</span>' : ''}
                        </div>
                        <small style="color: var(--text-secondary); font-size: 11px;">Updated: ${new Date(profile.updated_at).toLocaleDateString()}</small>
                    </div>
                    <div style="display: flex; gap: 6px;" onclick="event.stopPropagation()">
                        <button class="set-default-btn" data-profile="${profile.name}" title="${isDefault ? 'Current default' : 'Set as default'}" style="padding: 5px 8px; background: ${isDefault ? 'var(--text-secondary)' : 'var(--bg-tertiary)'}; color: ${isDefault ? 'white' : 'var(--text-primary)'}; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                            ${isDefault ? '★ Default' : '☆ Set Default'}
                        </button>
                        <button class="edit-profile-btn" data-profile="${profile.name}" title="Edit profile" style="padding: 5px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 4px; cursor: pointer;">
                            ✏️
                        </button>
                        <button class="delete-profile-btn" data-profile="${profile.name}" title="Delete profile" style="padding: 5px 8px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
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
