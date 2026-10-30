// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isNotInvitedError } from '../authInvite.js';

describe('registo só por convite', () => {
  it('reconhece a recusa de um email sem convite', () => {
    expect(isNotInvitedError({ status: 403, message: 'This app is private' })).toBe(true);
    expect(isNotInvitedError({ response: { status: 401 } })).toBe(true);
    expect(isNotInvitedError({ message: 'User not invited to this app' })).toBe(true);
    expect(isNotInvitedError({ data: { extra_data: { reason: 'auth_required' } } })).toBe(true);
  });

  it('deixa passar os outros erros tal como vêm', () => {
    expect(isNotInvitedError({ status: 400, message: 'Invalid verification code' })).toBe(false);
    expect(isNotInvitedError({ message: 'Network error' })).toBe(false);
    expect(isNotInvitedError(null)).toBe(false);
  });
});
