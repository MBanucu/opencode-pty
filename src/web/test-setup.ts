import '@testing-library/jest-dom/vitest';

// Mock window.location for jsdom environment
Object.defineProperty(window, 'location', {
  value: {
    host: 'localhost:8867',
    hostname: 'localhost',
    protocol: 'http:',
    port: '8867',
  },
  writable: true,
});