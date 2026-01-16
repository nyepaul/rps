/**
 * Advisor tab component - AI-powered retirement advice
 */

import { advisorAPI } from '../../api/advisor.js';
import { store } from '../../state/store.js';
import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

let currentConversationId = null;

export function renderAdvisorTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">🤖</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to chat with your AI advisor.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
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
                line-height: 1.6;
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
        
        const errorMsg = `Sorry, I encountered an error: ${error.message}. <br><br>
            <button onclick="import('./advisor-wizard.js').then(m => m.showAdvisorWizard())" style="padding: 5px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px;">
                🔧 Run Fix Wizard
            </button>`;
        
        addMessage(chatContainer, 'assistant', errorMsg, true);
    }
}

function addMessage(container, role, text, isHtml = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const avatar = role === 'user' ? '👤' : '🤖';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-text">${isHtml ? text : escapeHtml(text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    container.appendChild(messageDiv);

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
