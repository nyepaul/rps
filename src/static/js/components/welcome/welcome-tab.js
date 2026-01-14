/**
 * Welcome tab component
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showLoading, showError, createElement } from '../../utils/dom.js';

export function renderWelcomeTab(container) {
    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 42px; margin-bottom: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                Welcome to Your Retirement Planning Tool
            </h1>
            <p style="font-size: 18px; text-align: center; color: var(--text-secondary); margin-bottom: 50px;">
                Plan your future with confidence. Let's get started!
            </p>

            <div style="display: grid; gap: 20px; margin-bottom: 40px;">
                <div id="create-profile-card" class="welcome-card" style="cursor: pointer; padding: 30px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 12px; transition: all 0.3s; box-shadow: 0 2px 8px var(--shadow);">
                    <div style="font-size: 48px; margin-bottom: 15px;">✨</div>
                    <h2 style="font-size: 24px; margin-bottom: 10px; color: var(--text-primary);">Create New Profile</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Start your retirement planning journey. Create a profile to save your financial data.</p>
                </div>

                <div id="existing-profiles-card" class="welcome-card" style="cursor: pointer; padding: 30px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 12px; transition: all 0.3s; box-shadow: 0 2px 8px var(--shadow);">
                    <div style="font-size: 48px; margin-bottom: 15px;">📂</div>
                    <h2 style="font-size: 24px; margin-bottom: 10px; color: --text-primary);">Open Existing Profile</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 0;">Continue working on your saved retirement plans.</p>
                    <div id="profile-list-container" style="margin-top: 20px; display: none;"></div>
                </div>
            </div>

            <div style="text-align: center; padding: 30px; background: var(--info-bg); border-radius: 12px;">
                <h3 style="margin-bottom: 15px;">🎯 What You Can Do</h3>
                <ul style="text-align: left; display: inline-block; margin: 0;">
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

    // Add hover effects
    addCardHoverEffects(container);

    // Set up event handlers
    const createProfileCard = container.querySelector('#create-profile-card');
    const existingProfilesCard = container.querySelector('#existing-profiles-card');

    if (createProfileCard) {
        createProfileCard.addEventListener('click', showCreateProfileForm);
    }
    if (existingProfilesCard) {
        existingProfilesCard.addEventListener('click', showExistingProfiles);
    }
}

function addCardHoverEffects(container) {
    const cards = container.querySelectorAll('.welcome-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 8px 16px var(--shadow)';
            card.style.borderColor = 'var(--accent-color)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 8px var(--shadow)';
            card.style.borderColor = 'var(--border-color)';
        });
    });
}

function showCreateProfileForm() {
    const modal = createElement('div', {
        className: 'modal',
        style: {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000',
        },
    });

    const form = createElement('div', {
        style: {
            background: 'var(--bg-secondary)',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
        },
    });

    form.innerHTML = `
        <h2 style="margin-bottom: 20px;">Create New Profile</h2>
        <form id="create-profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Profile Name *</label>
                <input type="text" name="name" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Birth Date</label>
                <input type="date" name="birth_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px;">Target Retirement Date</label>
                <input type="date" name="retirement_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Create Profile
                </button>
            </div>
        </form>
    `;

    modal.appendChild(form);
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
        modal.remove();
    });

    // Form submission
    document.getElementById('create-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const profileData = {
            name: formData.get('name'),
            birth_date: formData.get('birth_date') || null,
            retirement_date: formData.get('retirement_date') || null,
            data: {}, // Start with empty data
        };

        try {
            const result = await profilesAPI.create(profileData);
            store.setState({ currentProfile: result.profile });
            modal.remove();

            // Switch to profile tab
            window.app.showTab('profile');
        } catch (error) {
            alert(`Error creating profile: ${error.message}`);
        }
    });
}

async function showExistingProfiles() {
    const container = document.getElementById('profile-list-container');
    container.style.display = 'block';

    showLoading(container, 'Loading profiles...');

    try {
        const data = await profilesAPI.list();
        const profiles = data.profiles || [];

        if (profiles.length === 0) {
            container.innerHTML = `
                <p style="color: var(--text-secondary); font-style: italic; margin-top: 10px;">
                    No profiles found. Create your first profile above!
                </p>
            `;
            return;
        }

        container.innerHTML = `
            <div style="margin-top: 15px;">
                <h4 style="margin-bottom: 10px;">Your Profiles:</h4>
                ${profiles.map(profile => `
                    <button
                        class="profile-btn"
                        data-profile="${profile.name}"
                        style="display: block; width: 100%; padding: 12px; margin-bottom: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.2s;"
                    >
                        <strong>${profile.name}</strong>
                        <br>
                        <small style="color: var(--text-secondary);">Updated: ${new Date(profile.updated_at).toLocaleDateString()}</small>
                    </button>
                `).join('')}
            </div>
        `;

        // Add click handlers to profile buttons
        document.querySelectorAll('.profile-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'var(--bg-tertiary)';
                btn.style.borderColor = 'var(--accent-color)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'var(--bg-primary)';
                btn.style.borderColor = 'var(--border-color)';
            });
            btn.addEventListener('click', async () => {
                const profileName = btn.getAttribute('data-profile');
                await loadProfile(profileName);
            });
        });

    } catch (error) {
        showError(container, error.message);
    }
}

async function loadProfile(profileName) {
    try {
        const data = await profilesAPI.get(profileName);
        store.setState({ currentProfile: data.profile });
        window.app.showTab('dashboard');
    } catch (error) {
        alert(`Error loading profile: ${error.message}`);
    }
}
