/**
 * MidSchool Manager - Form Validation Helpers
 * Provides reusable validation functions for form inputs.
 * Attaches to window.MSM.Validate
 */
(function () {
    'use strict';

    window.MSM = window.MSM || {};

    /* ------------------------------------------------------------------ */
    /*  Core validators                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * Check if a string value is non-empty after trimming.
     * @param {string} value
     * @returns {boolean}
     */
    function required(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    /**
     * Check if a numeric value is within a range (inclusive).
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {boolean}
     */
    function inRange(value, min, max) {
        var num = parseFloat(value);
        if (isNaN(num)) return false;
        return num >= min && num <= max;
    }

    /**
     * Check if a string is a valid date in YYYY-MM-DD format.
     * @param {string} value
     * @returns {boolean}
     */
    function isValidDate(value) {
        if (!value || typeof value !== 'string') return false;
        var match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return false;
        var d = new Date(value);
        return d instanceof Date && !isNaN(d.getTime());
    }

    /**
     * Check if endDate is after startDate.
     * @param {string} startDate - YYYY-MM-DD
     * @param {string} endDate - YYYY-MM-DD
     * @returns {boolean}
     */
    function isDateAfter(startDate, endDate) {
        if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
        return new Date(endDate) > new Date(startDate);
    }

    /**
     * Check if a score is valid for a given max score.
     * @param {number|string} score
     * @param {number} maxScore
     * @returns {boolean}
     */
    function isValidScore(score, maxScore) {
        var num = parseFloat(score);
        if (isNaN(num)) return false;
        return num >= 0 && num <= (maxScore || 20);
    }

    /* ------------------------------------------------------------------ */
    /*  DOM integration                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * Validate a form field and apply visual feedback.
     * @param {HTMLElement} input - The input element
     * @param {Function} validatorFn - Returns true if valid
     * @param {string} [errorMsg] - Message shown on invalid
     * @returns {boolean}
     */
    function validateField(input, validatorFn, errorMsg) {
        if (!input) return false;

        var value = input.value;
        var isValid = validatorFn(value);

        // Remove existing states
        input.classList.remove('field-valid', 'field-invalid');

        // Find or create validation message element
        var msgEl = input.parentElement
            ? input.parentElement.querySelector('.validation-message')
            : null;

        if (isValid) {
            input.classList.add('field-valid');
            if (msgEl) {
                msgEl.classList.remove('validation-message--visible', 'validation-message--error');
            }
        } else {
            input.classList.add('field-invalid');
            if (msgEl && errorMsg) {
                msgEl.textContent = errorMsg;
                msgEl.classList.add('validation-message--visible', 'validation-message--error');
            }
        }

        return isValid;
    }

    /**
     * Clear validation state from an input.
     * @param {HTMLElement} input
     */
    function clearValidation(input) {
        if (!input) return;
        input.classList.remove('field-valid', 'field-invalid');
        var msgEl = input.parentElement
            ? input.parentElement.querySelector('.validation-message')
            : null;
        if (msgEl) {
            msgEl.classList.remove('validation-message--visible');
        }
    }

    /**
     * Validate multiple fields and return overall status.
     * @param {Array<{input: HTMLElement, validator: Function, message: string}>} fields
     * @returns {boolean} true if all fields valid
     */
    function validateAll(fields) {
        var allValid = true;
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            if (!validateField(f.input, f.validator, f.message)) {
                allValid = false;
            }
        }
        return allValid;
    }

    /* ------------------------------------------------------------------ */
    /*  Public API                                                         */
    /* ------------------------------------------------------------------ */

    window.MSM.Validate = {
        required: required,
        inRange: inRange,
        isValidDate: isValidDate,
        isDateAfter: isDateAfter,
        isValidScore: isValidScore,
        validateField: validateField,
        clearValidation: clearValidation,
        validateAll: validateAll
    };

})();
