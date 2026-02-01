# DOM Testing: Advanced Features and APIs

This document covers advanced DOM testing patterns, available APIs, configuration options, and troubleshooting.

## Available DOM APIs

happy-dom provides a comprehensive implementation of browser APIs:

### Core DOM APIs

- `document` - Document root
- `document.body` - Body element
- `document.querySelector()` / `document.querySelectorAll()` - Element selection
- `document.createElement()` - Element creation
- `document.getElementById()` - ID-based selection
- `document.getElementsByClassName()` - Class-based selection

### Element APIs

- `element.innerHTML` - Get/set HTML content
- `element.textContent` - Get/set text content
- `element.classList` - CSS class manipulation
- `element.setAttribute()` / `element.getAttribute()` - Attribute handling
- `element.addEventListener()` / `element.removeEventListener()` - Event handling
- `element.click()` - Programmatic clicking
- `element.dispatchEvent()` - Event dispatching

### Window APIs

- `window` - Global window object
- `window.location` - URL handling
- `window.localStorage` / `window.sessionStorage` - Web storage
- `window.setTimeout()` / `window.setInterval()` - Timers
- `window.matchMedia()` - Media queries (mocked)
- `window.fetch()` - HTTP requests (mocked)

### Custom Elements

- `customElements.define()` - Register custom elements
- `customElements.get()` - Retrieve custom element constructors
- `HTMLElement` - Base class for custom elements

## Common Patterns and Best Practices

### 1. Clean DOM State Between Tests

Always clean up the DOM between tests to avoid state pollution:

```typescript
/// <reference lib="dom" />

import { test, expect, beforeEach, afterEach } from 'bun:test'

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

test('test with clean DOM', () => {
  // DOM is guaranteed to be empty
  expect(document.body.children.length).toBe(0)
})
```

### 2. Use Data Attributes for Testing

Use `data-testid` attributes for reliable element selection:

```typescript
document.body.innerHTML = `
  <button data-testid="submit-btn">Submit</button>
`

const button = document.querySelector('[data-testid="submit-btn"]')
```

### 3. Mock Browser APIs

For APIs not implemented in happy-dom, create mocks in your setup:

```typescript
// test-setup.ts
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})
```

### 4. Test File Organization

Structure DOM tests by feature or component:

```
test/
├── components/
│   ├── Button.test.tsx
│   ├── Modal.test.tsx
│   └── Form.test.tsx
├── utils/
│   └── dom-helpers.test.ts
└── integration/
    └── user-workflow.test.ts
```

### 5. Test Both Success and Error Cases

```typescript
/// <reference lib="dom" />

import { test, expect, describe } from 'bun:test'

describe('Form Validation', () => {
  test('accepts valid input', () => {
    document.body.innerHTML = '<input id="email" type="email" />'
    const input = document.getElementById('email') as HTMLInputElement

    input.value = 'valid@example.com'
    expect(input.validity.valid).toBe(true)
  })

  test('rejects invalid email', () => {
    document.body.innerHTML = '<input id="email" type="email" />'
    const input = document.getElementById('email') as HTMLInputElement

    input.value = 'not-an-email'
    expect(input.validity.valid).toBe(false)
  })
})
```

## Advanced Configuration

### Comprehensive Setup File

For complex projects, create a comprehensive setup file:

```typescript
// test-setup.ts
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach } from 'bun:test'

// Register happy-dom globals
GlobalRegistrator.register()

// Global mocks
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Clean up after each test
afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})
```

Update `bunfig.toml`:

```toml
[test]
preload = ["./test-setup.ts"]
```

### Custom Element Testing

```typescript
/// <reference lib="dom" />

import { test, expect, describe } from 'bun:test'

describe('Custom Elements', () => {
  test('can define and use custom elements', () => {
    class MyComponent extends HTMLElement {
      connectedCallback() {
        this.innerHTML = `<p>Hello from custom element</p>`
      }

      get value() {
        return this.getAttribute('value')
      }
    }

    customElements.define('my-component', MyComponent)

    document.body.innerHTML = '<my-component value="test"></my-component>'
    const element = document.querySelector('my-component')

    expect(element?.innerHTML).toContain('Hello from custom element')
    expect((element as MyComponent).value).toBe('test')
  })
})
```

## Comparison with Playwright

| Feature                | Bun + happy-dom | Playwright              |
| ---------------------- | --------------- | ----------------------- |
| **Execution speed**    | Milliseconds    | Seconds                 |
| **Real browser**       | No (simulated)  | Yes                     |
| **Visual regression**  | Not supported   | Supported               |
| **Network mocking**    | Limited         | Full support            |
| **Cross-browser**      | N/A             | Chrome, Firefox, Safari |
| **Mobile testing**     | No              | Device emulation        |
| **Accessibility**      | Limited         | Full a11y tree          |
| **Screenshot testing** | No              | Yes                     |

### When to Choose Each

**Use Bun + happy-dom when:**

- Testing component logic and state
- Running unit tests for DOM manipulation
- Need fast feedback during development
- Testing in CI/CD with minimal setup
- Testing custom elements and utilities

**Use Playwright when:**

- Testing complete user workflows
- Need real browser behavior
- Testing visual appearance
- Cross-browser compatibility testing
- Testing actual network requests
- Accessibility compliance testing

## Troubleshooting

### TypeScript Errors

**"Cannot find name 'document'"**

Add to the top of test files:

```typescript
/// <reference lib="dom" />
```

Or add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["dom", "es2020"]
  }
}
```

**"Cannot find name 'window'"**

Same solution as above - include DOM lib types.

### Runtime Errors

**"document is not defined"**

Ensure happy-dom preload is configured:

1. Check `bunfig.toml` has `[test] preload = ["./happydom.ts"]`
2. Verify `happydom.ts` imports and registers `GlobalRegistrator`
3. Run `bun test` (not node or other test runners)

**"HTMLElement is not defined"**

Same issue - happy-dom globals not registered. Check preload configuration.

### React Testing Library Issues

**"Unable to find element"**

- Use `screen.debug()` to print the current DOM
- Check that the component actually renders the element
- Use `data-testid` for reliable selection
- Wait for async rendering with `waitFor()`

```typescript
import { screen } from '@testing-library/react'

// Debug current DOM state
screen.debug()
```

**"act() warnings"**

Bun's test runner handles most async updates automatically. If you see act warnings:

- Wrap state updates in `act()` from `@testing-library/react`
- Use `waitFor()` for async assertions

### Performance Issues

**Slow tests with many DOM operations:**

- Use `beforeEach` to reset DOM instead of creating fresh in each test
- Clean up event listeners in `afterEach`
- Consider breaking large test files into smaller focused files
- Use `test.concurrent()` for independent tests

### Memory Leaks

**Tests slow down over multiple runs:**

```typescript
import { afterEach } from 'bun:test'

afterEach(() => {
  // Clean up DOM
  document.body.innerHTML = ''
  document.head.innerHTML = ''

  // Clear timers
  jest.clearAllTimers?.()
})
```

## Limitations and Known Issues

### Current Limitations

1. **No visual rendering**: happy-dom simulates the DOM but doesn't render visuals - no CSS layout calculations or visual assertions
2. **Limited CSS support**: Some advanced CSS selectors and pseudo-elements may not work
3. **No browser networking**: `fetch` in happy-dom is mocked - use proper mocking for network tests
4. **No WebGL/Canvas**: Graphics APIs are not implemented
5. **Single-threaded**: Unlike real browsers, happy-dom runs synchronously

### Known Issues

1. **Focus behavior**: Some focus-related events may behave differently from real browsers
2. **Scroll events**: Scroll position and events are limited
3. **Form submission**: Actual form submission (page navigation) is not supported
4. **iframe support**: iframes have limited support

### Workarounds

For functionality not available in happy-dom:

1. **Use Playwright** for visual and cross-browser testing
2. **Mock browser APIs** that aren't implemented
3. **Test in real browser** for critical visual components
4. **Use feature detection** in your code and test both paths

## Quick Reference

### Commands

```bash
# Run all DOM tests
bun test

# Run specific test file
bun test ./test/component.test.tsx

# Run tests matching pattern
bun test -t "DOM"

# Watch mode for development
bun test --watch

# Run with coverage
bun test --coverage
```

### Essential Imports

```typescript
/// <reference lib="dom" />

// Basic testing
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'

// React testing
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
```

### Common Patterns

```typescript
// Setup
document.body.innerHTML = `<div id="app"></div>`

// Query
const element = document.querySelector('#app')
const elements = document.querySelectorAll('.item')

// Events
element?.addEventListener('click', handler)
element?.click()
element?.dispatchEvent(new Event('custom'))

// Assertions
expect(element?.textContent).toBe('expected')
expect(element?.classList.contains('active')).toBe(true)
```

---

_For complete Bun documentation, visit: https://bun.com/docs_

_For happy-dom documentation, visit: https://github.com/capricorn86/happy-dom_
