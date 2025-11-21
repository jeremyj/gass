/**
 * SmartInputManager - Unified smart input field management
 *
 * Manages AUTO/MANUALE mode switching for input fields with automatic calculation.
 * Provides event-driven state management with debounced blur handling.
 */

class SmartInputManager {
  constructor(config) {
    // Configuration
    this.config = {
      blurDebounceMs: 150, // Allows save button clicks to register before blur
      comparisonThreshold: 0.01, // Minimum difference to consider values different (1 cent)
      ...config
    };

    // Unified state object - single source of truth
    this.state = {};

    // Debounce timers
    this.blurTimers = {};

    // Event listeners
    this.eventListeners = {
      stateChange: [],
      modeChange: [],
      saveRequired: []
    };
  }

  /**
   * Initialize a smart input field
   * @param {string} fieldId - Unique identifier for this field
   * @param {HTMLElement} inputElement - The input DOM element
   * @param {Function} calculationFn - Function that returns the calculated value
   */
  initField(fieldId, inputElement, calculationFn) {
    // Initialize state for this field
    this.state[fieldId] = {
      element: inputElement,
      calculationFn: calculationFn,
      mode: 'auto', // 'auto' or 'manual'
      originalValue: null, // Value when field was focused
      calculatedValue: null, // Last calculated value
      currentValue: null, // Current input value
      isManualOverride: false // True if user has explicitly overridden
    };

    // Set up event listeners
    this._attachEventListeners(fieldId, inputElement);

    // Initialize display
    this.updateField(fieldId);
  }

  /**
   * Attach event listeners to input element
   */
  _attachEventListeners(fieldId, element) {
    // Focus: Enable manual mode
    element.addEventListener('focus', (e) => this._handleFocus(fieldId, e));

    // Input: Update value while typing
    element.addEventListener('input', (e) => this._handleInput(fieldId, e));

    // Blur: Check if should revert to auto (debounced)
    element.addEventListener('blur', (e) => this._handleBlur(fieldId, e));
  }

  /**
   * Handle focus event - switch to manual mode
   */
  _handleFocus(fieldId, event) {
    const state = this.state[fieldId];
    if (!state) return;

    // Save original value for comparison
    state.originalValue = state.currentValue;

    // Switch to manual mode
    state.mode = 'manual';
    state.element.removeAttribute('readonly');

    // Update UI
    this._updateBadge(fieldId, 'manual');
    this._updateFieldClass(fieldId, 'manual');

    // Emit event
    this._emit('modeChange', { fieldId, mode: 'manual', value: state.currentValue });
    this._checkSaveRequired();
  }

  /**
   * Handle input event - maintain manual state while typing
   */
  _handleInput(fieldId, event) {
    const state = this.state[fieldId];
    if (!state) return;

    // Normalize input (comma to dot, decimal validation)
    this._normalizeInput(state.element);

    // Update current value
    state.currentValue = this._parseAmount(state.element.value);
    state.isManualOverride = true;

    // Emit event
    this._emit('stateChange', { fieldId, value: state.currentValue });
  }

  /**
   * Handle blur event - check if should revert to auto (debounced)
   */
  _handleBlur(fieldId, event) {
    // Clear existing timer
    if (this.blurTimers[fieldId]) {
      clearTimeout(this.blurTimers[fieldId]);
    }

    // Debounce to allow save button clicks to register
    this.blurTimers[fieldId] = setTimeout(() => {
      this._processBlur(fieldId);
    }, this.config.blurDebounceMs);
  }

  /**
   * Process blur after debounce delay
   */
  _processBlur(fieldId) {
    const state = this.state[fieldId];
    if (!state) return;

    const inputValue = this._parseAmount(state.element.value);
    const calculatedValue = this._getCalculatedValue(fieldId);

    // Determine if should revert to auto
    const isEmpty = inputValue === null || inputValue === 0;
    const matchesCalculated = calculatedValue !== null &&
                             Math.abs(inputValue - calculatedValue) < this.config.comparisonThreshold;

    if (isEmpty || matchesCalculated) {
      // Revert to auto mode
      this._setAutoMode(fieldId);
    } else {
      // Stay in manual mode
      state.currentValue = inputValue;
      state.isManualOverride = true;
    }

    this._checkSaveRequired();
  }

  /**
   * Set field to auto mode
   */
  _setAutoMode(fieldId) {
    const state = this.state[fieldId];
    if (!state) return;

    state.mode = 'auto';
    state.isManualOverride = false;
    state.element.setAttribute('readonly', '');

    // Update to calculated value
    this.updateField(fieldId);

    // Update UI
    this._updateBadge(fieldId, 'auto');
    this._updateFieldClass(fieldId, 'auto');

    // Emit event
    this._emit('modeChange', { fieldId, mode: 'auto', value: state.currentValue });
  }

  /**
   * Update field display with calculated or manual value
   */
  updateField(fieldId) {
    const state = this.state[fieldId];
    if (!state) return;

    if (state.mode === 'auto') {
      // Show calculated value
      const calculatedValue = this._getCalculatedValue(fieldId);
      state.calculatedValue = calculatedValue;
      state.currentValue = calculatedValue;

      if (calculatedValue !== null) {
        state.element.value = calculatedValue.toFixed(2);
      } else {
        state.element.value = '0.00';
      }
    }
    // In manual mode, keep user's entered value
  }

  /**
   * Get calculated value for a field
   */
  _getCalculatedValue(fieldId) {
    const state = this.state[fieldId];
    if (!state || !state.calculationFn) return null;

    try {
      const value = state.calculationFn();
      return typeof value === 'number' ? value : null;
    } catch (error) {
      console.error(`Error calculating value for ${fieldId}:`, error);
      return null;
    }
  }

  /**
   * Update badge display (AUTO/MANUALE)
   */
  _updateBadge(fieldId, mode) {
    const state = this.state[fieldId];
    if (!state) return;

    // Find badge element (next sibling with .badge class)
    const badge = state.element.nextElementSibling;
    if (!badge || !badge.classList.contains('badge')) return;

    if (mode === 'auto') {
      badge.textContent = 'AUTO';
      badge.classList.remove('manual');
      badge.classList.add('auto');
    } else {
      badge.textContent = 'MANUALE';
      badge.classList.remove('auto');
      badge.classList.add('manual');
    }
  }

  /**
   * Update field CSS class
   */
  _updateFieldClass(fieldId, mode) {
    const state = this.state[fieldId];
    if (!state) return;

    if (mode === 'auto') {
      state.element.classList.remove('manual-input');
      state.element.classList.add('auto-input');
    } else {
      state.element.classList.remove('auto-input');
      state.element.classList.add('manual-input');
    }
  }

  /**
   * Normalize input field value (comma to dot, decimal validation)
   */
  _normalizeInput(element) {
    let value = element.value;

    // Replace comma with dot
    value = value.replace(',', '.');

    // Allow only valid decimal format: optional minus, digits, optional single dot and digits
    const validPattern = /^-?\d*\.?\d*$/;
    if (!validPattern.test(value)) {
      // Revert to previous valid value
      const selectionStart = element.selectionStart;
      element.value = element.value.slice(0, -1);
      element.setSelectionRange(selectionStart - 1, selectionStart - 1);
      return;
    }

    element.value = value;
  }

  /**
   * Parse amount string to number
   */
  _parseAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? null : num;
  }

  /**
   * Check if any fields require save and emit event
   */
  _checkSaveRequired() {
    const hasManualOverride = Object.values(this.state).some(s => s.isManualOverride);
    this._emit('saveRequired', { required: hasManualOverride });
  }

  /**
   * Get field state
   */
  getFieldState(fieldId) {
    return this.state[fieldId] ? { ...this.state[fieldId] } : null;
  }

  /**
   * Get all fields with manual overrides
   */
  getManualOverrides() {
    const overrides = {};
    for (const [fieldId, state] of Object.entries(this.state)) {
      if (state.isManualOverride) {
        overrides[fieldId] = {
          value: state.currentValue,
          calculatedValue: state.calculatedValue,
          hasDifference: state.calculatedValue !== null &&
                        Math.abs(state.currentValue - state.calculatedValue) >= this.config.comparisonThreshold
        };
      }
    }
    return overrides;
  }

  /**
   * Check if a specific field has an override with actual difference
   */
  hasSignificantOverride(fieldId) {
    const state = this.state[fieldId];
    if (!state || !state.isManualOverride) return false;

    const calculatedValue = this._getCalculatedValue(fieldId);
    if (calculatedValue === null) return false;

    return Math.abs(state.currentValue - calculatedValue) >= this.config.comparisonThreshold;
  }

  /**
   * Reset all fields to auto mode
   */
  resetAll() {
    for (const fieldId of Object.keys(this.state)) {
      this._setAutoMode(fieldId);
    }
  }

  /**
   * Force recalculate all auto fields
   */
  recalculateAll() {
    for (const fieldId of Object.keys(this.state)) {
      if (this.state[fieldId].mode === 'auto') {
        this.updateField(fieldId);
      }
    }
    this._emit('stateChange', { type: 'recalculate' });
  }

  /**
   * Register event listener
   */
  on(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].push(callback);
    }
  }

  /**
   * Unregister event listener
   */
  off(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType] = this.eventListeners[eventType].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  _emit(eventType, data) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} event listener:`, error);
        }
      });
    }
  }

  /**
   * Destroy manager and clean up
   */
  destroy() {
    // Clear all timers
    for (const timer of Object.values(this.blurTimers)) {
      clearTimeout(timer);
    }

    // Remove event listeners
    for (const state of Object.values(this.state)) {
      if (state.element) {
        state.element.replaceWith(state.element.cloneNode(true));
      }
    }

    // Clear state
    this.state = {};
    this.blurTimers = {};
    this.eventListeners = { stateChange: [], modeChange: [], saveRequired: [] };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartInputManager;
}
