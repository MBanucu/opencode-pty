import '@testing-library/jest-dom/vitest';

// Mock window.location for jsdom or node environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    value: {
      host: 'localhost:8867',
      hostname: 'localhost',
      protocol: 'http:',
      port: '8867',
    },
    writable: true,
  });
} else {
  // For node environment, mock global.window
  (globalThis as any).window = {
    location: {
      host: 'localhost:8867',
      hostname: 'localhost',
      protocol: 'http:',
      port: '8867',
    },
  };
}