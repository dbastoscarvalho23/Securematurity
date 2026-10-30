/**
 * Shared client-side validation utilities for security-critical forms.
 * Validates user input before submission; the platform backend remains the
 * final source of truth.
 */

export const validators = {
  required: (value) => {
    if (value === null || value === undefined) return 'Campo obrigatório.';
    if (typeof value === 'string' && !value.trim()) return 'Campo obrigatório.';
    return null;
  },

  minLength: (value, min) => {
    if (!value) return null;
    if (String(value).trim().length < min) return `Indique pelo menos ${min} caracteres.`;
    return null;
  },

  maxLength: (value, max) => {
    if (!value) return null;
    if (String(value).length > max) return `Indique no máximo ${max} caracteres.`;
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(String(value).trim())) return 'Indique um endereço de email válido.';
    return null;
  },

  emailList: (value) => {
    if (!value || !value.trim()) return null;
    const emails = value.split(',').map(e => e.trim()).filter(Boolean);
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.find(e => !re.test(e));
    if (invalid) return `«${invalid}» não é um endereço de email válido.`;
    return null;
  },

  dateAfter: (dateStr, afterDateStr) => {
    if (!dateStr || !afterDateStr) return null;
    if (new Date(dateStr) <= new Date(afterDateStr)) {
      return 'A data tem de ser posterior à data de nomeação.';
    }
    return null;
  },

  inRange: (value, min, max) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return 'Indique um número.';
    if (num < min) return `O valor mínimo é ${min}.`;
    if (num > max) return `O valor máximo é ${max}.`;
    return null;
  },

  enum: (value, allowed) => {
    if (!value) return null;
    if (!allowed.includes(value)) return 'Seleção inválida.';
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