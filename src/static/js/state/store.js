/**
 * Simple state management store
 */

class Store {
    constructor() {
        this.state = {
            currentUser: null,
            currentProfile: null,
            profiles: [],
            scenarios: [],
            actionItems: [],
            isLoading: false,
            currentTab: 'welcome',
            appVersion: null,
            appReleaseDate: null,
            appReleaseNotes: null,
        };
        this.listeners = [];
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Update state and notify listeners
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notify();
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener) {
        this.listeners.push(listener);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all listeners of state change
     */
    notify() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Get specific state value
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Set specific state value
     */
    set(key, value) {
        this.setState({ [key]: value });
    }
}

// Export singleton instance
export const store = new Store();

// Export class for testing
export default Store;
