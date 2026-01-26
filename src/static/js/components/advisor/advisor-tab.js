/**
 * Advisor tab component - AI-powered retirement advice
 */

import { advisorAPI } from '../../api/advisor.js';
import { actionItemsAPI } from '../../api/action-items.js';
import { store } from '../../state/store.js';
import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

let currentConversationId = null;

export function renderAdvisorTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">🤖</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to chat with your AI advisor.
                </p>
                <button id="go-to-welcome-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 20px; height: calc(100vh - 200px); display: flex; flex-direction: column;">
            <div style="margin-bottom: 20px;">
                <h1 style="font-size: 36px; margin-bottom: 10px;">AI Retirement Advisor</h1>
                <p style="color: var(--text-secondary);">
                    Profile: <strong>${profile.name}</strong> | Get personalized advice powered by AI
                </p>
            </div>

            <!-- Chat Container -->
            <div id="chat-container" style="flex: 1; background: var(--bg-secondary); border-radius: 12px; padding: 20px; overflow-y: auto; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px;">
                <!-- Welcome message -->
                <div class="message assistant-message">
                    <div class="message-avatar">🤖</div>
                    <div class="message-content">
                        <div class="message-text">
                            <strong>Hello! I'm your AI Retirement Advisor.</strong><br><br>
                            I can help you with:
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Analyzing your retirement readiness</li>
                                <li>Optimizing your investment strategy</li>
                                <li>Planning Social Security claiming strategies</li>
                                <li>Tax optimization and Roth conversions</li>
                                <li>Withdrawal strategies and spending plans</li>
                            </ul>
                            What would you like to discuss today?
                        </div>
                    </div>
                </div>
            </div>

            <!-- Input Area -->
            <div style="display: flex; gap: 10px;">
                <textarea
                    id="chat-input"
                    placeholder="Ask me anything about your retirement planning..."
                    rows="3"
                    style="flex: 1; padding: 12px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); font-size: 16px; resize: none; font-family: inherit;"
                ></textarea>
                <button
                    id="send-btn"
                    style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; align-self: flex-end;"
                >
                    Send
                </button>
            </div>

            <!-- Quick Actions -->
            <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                <button class="quick-action-btn" data-message="Analyze my current retirement plan">
                    📊 Analyze My Plan
                </button>
                <button class="quick-action-btn" data-message="What should I do to improve my retirement readiness?">
                    💡 Improvement Tips
                </button>
                <button id="troubleshoot-btn" class="quick-action-btn" style="background: var(--info-bg); color: var(--info-color);">
                    🔧 Troubleshoot Advisor
                </button>
                <button id="clear-history-btn" class="quick-action-btn" style="background: var(--danger-bg); color: var(--danger-color);">
                    🗑️ Clear Chat
                </button>
            </div>
        </div>

        <style>
            #chat-container {
                scrollbar-width: thin;
            }
            #chat-container::-webkit-scrollbar {
                width: 8px;
            }
            #chat-container::-webkit-scrollbar-thumb {
                background: var(--border-color);
                border-radius: 4px;
            }
            .message {
                display: flex;
                gap: 12px;
                align-items: flex-start;
                animation: slideIn 0.3s ease-out;
            }
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .message-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                flex-shrink: 0;
            }
            .user-message .message-avatar {
                background: var(--accent-color);
                color: white;
            }
            .assistant-message .message-avatar {
                background: var(--bg-tertiary);
            }
            .message-content {
                flex: 1;
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 15px;
            }
            .user-message .message-content {
                background: var(--accent-color);
                color: white;
            }
            .message-text {
                line-height: 1.7;
                font-size: 15px;
            }
            .message-text h1, .message-text h2, .message-text h3 {
                margin-top: 20px;
                margin-bottom: 12px;
            }
            .message-text h1:first-child,
            .message-text h2:first-child,
            .message-text h3:first-child {
                margin-top: 0;
            }
            .message-text ul, .message-text ol {
                margin: 12px 0;
                padding-left: 24px;
            }
            .message-text li {
                margin-bottom: 8px;
                line-height: 1.6;
            }
            .message-text p {
                margin: 12px 0;
            }
            .message-text p:first-child {
                margin-top: 0;
            }
            .message-text p:last-child {
                margin-bottom: 0;
            }
            .message-text strong {
                font-weight: 600;
                color: var(--text-primary);
            }
            .message-text em {
                font-style: italic;
                color: var(--text-secondary);
            }
            .message-text hr {
                border: none;
                border-top: 1px solid var(--border-color);
                margin: 20px 0;
            }
            .message-time {
                font-size: 12px;
                color: var(--text-light);
                margin-top: 8px;
            }
            .quick-action-btn {
                padding: 8px 16px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .quick-action-btn:hover {
                background: var(--bg-quaternary);
                border-color: var(--accent-color);
                transform: translateY(-1px);
            }
            #send-btn:hover {
                background: var(--accent-hover);
            }
            #send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .add-to-action-items-btn:hover {
                opacity: 0.9;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            .add-to-action-items-btn:disabled {
                cursor: not-allowed;
            }
            .typing-indicator {
                display: flex;
                gap: 4px;
                padding: 10px;
            }
            .typing-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--text-secondary);
                animation: typing 1.4s infinite;
            }
            .typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }
            .typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }
            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                }
                30% {
                    transform: translateY(-10px);
                }
            }
        </style>
    `;

    setupAdvisorHandlers(container, profile);
}

function setupAdvisorHandlers(container, profile) {
    const chatInput = container.querySelector('#chat-input');
    const sendBtn = container.querySelector('#send-btn');
    const chatContainer = container.querySelector('#chat-container');

    if (!chatInput || !sendBtn || !chatContainer) return;

    // Troubleshoot button
    const troubleshootBtn = container.querySelector('#troubleshoot-btn');
    if (troubleshootBtn) {
        troubleshootBtn.addEventListener('click', () => {
            import('./advisor-wizard.js').then(m => m.showAdvisorWizard());
        });
    }

    // Send button click
    sendBtn.addEventListener('click', () => {
        sendMessage(profile, chatInput, chatContainer);
    });

    // Enter key to send (Shift+Enter for new line)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(profile, chatInput, chatContainer);
        }
    });

    // Quick action buttons
    container.querySelectorAll('.quick-action-btn[data-message]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const message = btn.dataset.message;
            chatInput.value = message;
            sendMessage(profile, chatInput, chatContainer);
        });
    });

    // Clear history button
    const clearBtn = container.querySelector('#clear-history-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all chat history? This cannot be undone.')) {
                clearChat(chatContainer);
            }
        });
    }
}

async function sendMessage(profile, chatInput, chatContainer) {
    const message = chatInput.value.trim();

    if (!message) {
        return;
    }

    // Add user message to chat
    addMessage(chatContainer, 'user', message);

    // Clear input
    chatInput.value = '';

    // Show typing indicator
    const typingId = showTypingIndicator(chatContainer);

    try {
        // Send to API
        const response = await advisorAPI.chat(profile.name, message, currentConversationId);

        // Update conversation ID if provided
        if (response.conversation_id) {
            currentConversationId = response.conversation_id;
        }

        // Remove typing indicator
        removeTypingIndicator(chatContainer, typingId);

        // Add assistant response
        addMessage(chatContainer, 'assistant', response.response || response.message);

    } catch (error) {
        console.error('Chat error:', error);
        removeTypingIndicator(chatContainer, typingId);

        const errorMessage = error.message || 'Unknown error';
        const isApiKeyError = /API[_ ]key|api-keys|setup-api-keys|Gemini|Claude/i.test(errorMessage) && 
                             (errorMessage.includes('not configured') || errorMessage.includes('not set') || errorMessage.includes('missing'));

        // Check if this is an API key error
        if (isApiKeyError) {
            const errorMsg = `Sorry, AI provider not configured. ${errorMessage}<br><br>
                <button onclick="window.app.openSettings('api-keys', 'gemini-api-key')" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                    🤖 Configure AI Settings
                </button>`;
            addMessage(chatContainer, 'assistant', errorMsg, true);
            
            // Automatically open settings after a short delay
            setTimeout(() => {
                if (window.app && window.app.openSettings) {
                    window.app.openSettings('api-keys', 'gemini-api-key');
                }
            }, 1500);
        } else {
            const errorMsg = `Sorry, I encountered an error: ${errorMessage}. <br><br>
                <button onclick="import('./advisor-wizard.js').then(m => m.showAdvisorWizard())" style="padding: 5px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px;">
                    🔧 Run Fix Wizard
                </button>`;
            addMessage(chatContainer, 'assistant', errorMsg, true);
        }
    }
}

function formatMarkdown(text) {
    // Escape HTML first
    let html = escapeHtml(text);

    // Bold/Italic with *** (bold italic)
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold with **
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic with *
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Headings
    html = html.replace(/^### (.*$)/gm, '<h3 style="font-size: 18px; font-weight: 700; margin: 20px 0 12px 0; color: var(--text-primary); border-bottom: 2px solid var(--border-color); padding-bottom: 8px;">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 style="font-size: 20px; font-weight: 700; margin: 24px 0 14px 0; color: var(--text-primary);">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 style="font-size: 22px; font-weight: 700; margin: 28px 0 16px 0; color: var(--text-primary);">$1</h1>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">');

    // Bullet lists (unordered)
    html = html.replace(/^\* (.*$)/gm, '<li style="margin-left: 20px; margin-bottom: 6px; line-height: 1.6;">$1</li>');
    html = html.replace(/(<li.*<\/li>)/s, '<ul style="margin: 12px 0; padding-left: 20px;">$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p style="margin: 12px 0;">');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = '<p style="margin: 12px 0;">' + html + '</p>';

    // Clean up extra paragraph tags around block elements
    html = html.replace(/<p[^>]*><\/p>/g, '');
    html = html.replace(/<p[^>]*>(<h[1-3]|<hr|<ul)/g, '$1');
    html = html.replace(/(<\/h[1-3]>|<\/hr>|<\/ul>)<\/p>/g, '$1');

    return html;
}

function addMessage(container, role, text, isHtml = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const avatar = role === 'user' ? '👤' : '🤖';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Format markdown for assistant messages
    const formattedText = isHtml ? text : (role === 'assistant' ? formatMarkdown(text) : escapeHtml(text));

    // Add "Add to Action Items" button for assistant messages
    const actionButton = role === 'assistant' && !isHtml ? `
        <button class="add-to-action-items-btn" data-message="${escapeHtml(text).replace(/"/g, '&quot;')}"
            style="margin-top: 10px; padding: 6px 12px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
            ✅ Add to Action Items
        </button>
    ` : '';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-text">${formattedText}</div>
            ${actionButton}
            <div class="message-time">${time}</div>
        </div>
    `;

    container.appendChild(messageDiv);

    // Add event listener for action button
    if (role === 'assistant' && !isHtml) {
        const btn = messageDiv.querySelector('.add-to-action-items-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                await addRecommendationToActionItems(text, btn);
            });
        }
    }

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator(container) {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant-message';
    typingDiv.id = 'typing-indicator';

    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;

    return 'typing-indicator';
}

function removeTypingIndicator(container, typingId) {
    const typingDiv = container.querySelector('#' + typingId);
    if (typingDiv) {
        typingDiv.remove();
    }
}

function clearChat(container) {
    // Keep only the welcome message
    const messages = container.querySelectorAll('.message');
    messages.forEach((msg, index) => {
        if (index > 0) { // Skip first message (welcome)
            msg.remove();
        }
    });

    currentConversationId = null;
    showSuccess('Chat history cleared.');
}

async function addRecommendationToActionItems(text, button) {
    const profile = store.get('currentProfile');

    if (!profile) {
        showError('No profile selected');
        return;
    }

    try {
        // Disable button and show loading state
        button.disabled = true;
        button.style.opacity = '0.5';
        button.textContent = 'Adding...';

        // Parse the recommendation text into actionable items
        // Look for bullet points, numbered lists, or sentences with action verbs
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const actionItems = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Check if line looks like an action item (starts with -, *, number, or contains action verbs)
            const isActionItem =
                trimmed.match(/^[-*•]\s/) || // Bullet point
                trimmed.match(/^\d+[\.)]\s/) || // Numbered list
                trimmed.match(/\b(consider|review|analyze|optimize|delay|claim|convert|increase|decrease|adjust|plan|evaluate|compare|research|consult|implement|calculate|estimate|maximize|minimize)\b/i); // Action verbs

            if (isActionItem && trimmed.length > 10 && trimmed.length < 300) {
                // Clean up the text
                const cleanText = trimmed
                    .replace(/^[-*•]\s*/, '') // Remove bullet
                    .replace(/^\d+[\.)]\s*/, '') // Remove numbering
                    .trim();

                if (cleanText) {
                    actionItems.push(cleanText);
                }
            }
        }

        // If no specific action items found, create one from the entire recommendation
        if (actionItems.length === 0) {
            actionItems.push(text.substring(0, 250) + (text.length > 250 ? '...' : ''));
        }

        // Create action items
        let createdCount = 0;
        for (const itemText of actionItems.slice(0, 10)) { // Limit to 10 items
            const actionItemData = {
                profile_name: profile.name,
                title: itemText.length > 100 ? itemText.substring(0, 97) + '...' : itemText,
                description: itemText,
                category: 'advisor_recommendation',
                priority: 'medium',
                status: 'pending',
                source: 'ai_advisor'
            };

            await actionItemsAPI.create(actionItemData);
            createdCount++;
        }

        // Update button to show success
        button.style.background = 'var(--success-color)';
        button.textContent = `✓ Added ${createdCount} item${createdCount > 1 ? 's' : ''}`;

        showSuccess(`${createdCount} action item${createdCount > 1 ? 's' : ''} added! View them in the Action Items tab.`);

        // Re-enable button after a delay
        setTimeout(() => {
            button.disabled = false;
            button.style.opacity = '1';
            button.textContent = '✅ Add to Action Items';
            button.style.background = 'var(--success-color)';
        }, 3000);

    } catch (error) {
        console.error('Error adding recommendation to action items:', error);
        showError(`Failed to add to action items: ${error.message}`);

        // Reset button
        button.disabled = false;
        button.style.opacity = '1';
        button.textContent = '✅ Add to Action Items';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
