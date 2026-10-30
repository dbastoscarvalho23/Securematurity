import { vi } from 'vitest';

// jsdom lacks matchMedia, required by several shadcn/ui primitives. Tests that run in the node environment
// (`// @vitest-environment node`, e.g. the audit chain) have no window.
if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});
