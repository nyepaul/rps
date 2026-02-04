/**
 * Validation utilities for form fields
 * Provides consistent UI feedback for errors, warnings, and success states
 */

/**
 * Set a field to error state with a message
 * @param {HTMLElement} inputElement - The input element to mark
 * @param {string} message - The error message
 */
export function setFieldError(inputElement, message) {
    if (!inputElement) return;

    // Check if error already exists
    let errorDiv = inputElement.parentElement.querySelector('.field-error');
    
    inputElement.style.borderColor = 'var(--danger-color)';
    inputElement.classList.add('is-invalid');
    inputElement.classList.remove('is-warning');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = 'var(--danger-color)';
        errorDiv.style.fontSize = '11px';
        errorDiv.style.marginTop = '4px';
        errorDiv.style.fontWeight = '600';
        inputElement.parentElement.appendChild(errorDiv);
    }
    
    errorDiv.textContent = `⚠️ ${message}`;
    
    // Remove warning if exists
    const warningDiv = inputElement.parentElement.querySelector('.field-warning');
    if (warningDiv) warningDiv.remove();
}

/**
 * Set a field to warning state (yellow/amber)
 * @param {HTMLElement} inputElement - The input element to mark
 * @param {string} message - The warning message
 */
export function setFieldWarning(inputElement, message) {
    if (!inputElement) return;

    // Don't override error state
    if (inputElement.classList.contains('is-invalid')) return;

    let warningDiv = inputElement.parentElement.querySelector('.field-warning');
    
    inputElement.style.borderColor = 'var(--warning-color)';
    inputElement.classList.add('is-warning');
    
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.className = 'field-warning';
        warningDiv.style.color = 'var(--warning-color)';
        warningDiv.style.fontSize = '11px';
        warningDiv.style.marginTop = '4px';
        warningDiv.style.fontWeight = '600';
        inputElement.parentElement.appendChild(warningDiv);
    }
    
    warningDiv.textContent = `💡 ${message}`;
}

/**
 * Clear all error/warning states from a field
 * @param {HTMLElement} inputElement - The input element to clear
 */
export function clearFieldError(inputElement) {
    if (!inputElement) return;
    
    const errorDiv = inputElement.parentElement.querySelector('.field-error');
    if (errorDiv) errorDiv.remove();
    
    const warningDiv = inputElement.parentElement.querySelector('.field-warning');
    if (warningDiv) warningDiv.remove();
    
    inputElement.style.borderColor = ''; 
    inputElement.classList.remove('is-invalid');
    inputElement.classList.remove('is-warning');
}

/**
 * Validate age and apply feedback
 * @param {HTMLElement} inputElement - Date input or number input
 * @param {number} age - Calculated age
 * @param {object} options - { min: 18, max: 100, label: 'Age' }
 */
export function validateAge(inputElement, age, options = { min: 18, max: 100, label: 'Age' }) {
    if (age === null || isNaN(age)) {
        clearFieldError(inputElement);
        return true;
    }

    if (age < options.min) {
        setFieldError(inputElement, `${options.label} must be at least ${options.min} (Calculated: ${age})`);
        return false;
    } else if (age > options.max) {
        setFieldWarning(inputElement, `Unusual ${options.label.toLowerCase()} - please verify (Calculated: ${age})`);
        return true; // Warnings are non-blocking
    } else {
        clearFieldError(inputElement);
        return true;
    }
}
