/**
 * Escapes HTML special characters in a value to prevent HTML injection
 * in email templates and other HTML output.
 *
 * @param {*} value - The value to escape (converted to string).
 * @returns {string} The HTML-escaped string.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}