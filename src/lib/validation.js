/**
 * Shared client-side validation utilities for security-critical forms.
 * Validates user input before submission; the platform backend remains the
 * final source of truth.
 */

export const validators = {
  required: (value) => {
    if (value === null || value === undefined) return 'This field is required.';
    if (typeof value === 'string' && !value.trim()) return 'This field is required.';
    return null;
  },

  minLength: (value, min) => {
    if (!value) return null;
    if (String(value).trim().length < min) return `Must be at least ${min} characters.`;
    return null;
  },

  maxLength: (value, max) => {
    if (!value) return null;
    if (String(value).length > max) return `Must be at most ${max} characters.`;
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(String(value).trim())) return 'Please enter a valid email address.';
    return null;
  },

  emailList: (value) => {
    if (!value || !value.trim()) return null;
    const emails = value.split(',').map(e => e.trim()).filter(Boolean);
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.find(e => !re.test(e));
    if (invalid) return `"${invalid}" is not a valid email address.`;
    return null;
  },

  dateAfter: (dateStr, afterDateStr) => {
    if (!dateStr || !afterDateStr) return null;
    if (new Date(dateStr) <= new Date(afterDateStr)) {
      return 'Date must be after the nomination date.';
    }
    return null;
  },

  inRange: (value, min, max) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return 'Must be a number.';
    if (num < min) return `Must be at least ${min}.`;
    if (num > max) return `Must be at most ${max}.`;
    return null;
  },

  enum: (value, allowed) => {
    if (!value) return null;
    if (!allowed.includes(value)) return 'Invalid selection.';
    return null;
  },
};

/**
 * Run a set of field validators and return an errors object.
 * @param {Object} values - form values
 * @param {Object} schema - { fieldName: validatorFunction | validatorFunction[] }
 * @returns {Object} errors - { fieldName: errorMessage }
 */
export function validateForm(values, schema) {
  const errors = {};
  for (const [field, validator] of Object.entries(schema)) {
    const fns = Array.isArray(validator) ? validator : [validator];
    for (const fn of fns) {
      const error = fn(values[field], values);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}