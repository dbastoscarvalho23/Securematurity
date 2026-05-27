import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

/**
 * A user picker that shows a dropdown when users are available,
 * or falls back to a plain email text input.
 */
export default function UserSelect({ value, onChange, users = [], placeholder = 'Select user...', disabled = false, className = '', inputClassName = '' }) {
  if (users.length > 0) {
    return (
      <Select value={value || ''} onValueChange={v => onChange(v === '__none__' ? '' : v)} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {users.map(u => (
            <SelectItem key={u.id} value={u.email}>
              {u.full_name ? `${u.full_name} (${u.email})` : u.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder="email@company.com"
      disabled={disabled}
      className={inputClassName}
    />
  );
}