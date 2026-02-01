# DOM Testing: Setup and Basics

This document covers the fundamentals of DOM testing with Bun using happy-dom and React Testing Library.

## What is Bun's DOM Testing?

Bun's test runner works seamlessly with DOM testing libraries to simulate a browser environment for testing frontend code. Unlike E2E tests that run in real browsers, DOM tests run in a headless JavaScript environment that implements browser APIs like `document`, `window`, and DOM manipulation methods.

### When to Use DOM Testing

- **Testing UI components** in isolation without a real browser
- **Unit testing** component logic and DOM manipulation
- **Fast feedback loops** during development (DOM tests run in milliseconds)
- **CI/CD pipelines** where browser automation is slow or unreliable
- **Testing custom elements** and web components
- **Validating HTML generation** and template rendering

### DOM Testing vs E2E Testing

| Aspect       | DOM Testing (happy-dom)             | E2E Testing (Playwright)         |
| ------------ | ----------------------------------- | -------------------------------- |
| **Speed**    | Very fast (milliseconds)            | Slower (seconds per test)        |
| **Browser**  | Simulated JavaScript environment    | Real browser (Chromium, Firefox) |
| **Use case** | Component/unit testing              | Full user workflows              |
| **Setup**    | Lightweight, no browser install     | Requires browser binaries        |
| **Accuracy** | Good for logic, limited for visuals | Pixel-perfect, real rendering    |

## Installation and Setup

### Prerequisites

Bun's DOM testing requires installing the `happy-dom` package as a dev dependency:

```bash
bun add -d @happy-dom/global-registrator
```

### Step 1: Create the Preload File

Create a file called `happydom.ts` in your project root to register happy-dom globals before tests run:

```typescript
// happydom.ts
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()
```

This makes browser APIs like `document`, `window`, `HTMLElement`, and other DOM methods available in the global scope during tests.

### Step 2: Configure Bun

Add the preload configuration to your `bunfig.toml` file:

```toml
# bunfig.toml
[test]
preload = ["./happydom.ts"]
```

This ensures `happydom.ts` runs automatically before every `bun test` invocation.

### Step 3: TypeScript Support (Optional)

If you see TypeScript errors like "Cannot find name 'document'", add the DOM lib reference at the top of your test files:

```typescript
/// <reference lib="dom" />

import { test, expect } from 'bun:test'

test('dom test', () => {
  document.body.innerHTML = `<button>My button</button>`
  const button = document.querySelector('button')
  expect(button?.innerText).toEqual('My button')
})
```

Alternatively, add `"lib": ["dom"]` to your `tsconfig.json` compiler options for global DOM types.

## Basic Usage Examples

### Testing DOM Elements

```typescript
/// <reference lib="dom" />

import { test, expect, describe } from 'bun:test'

describe('DOM Manipulation', () => {
  test('should query and manipulate DOM elements', () => {
    // Arrange: Set up DOM
    document.body.innerHTML = `
      <div id="app">
        <button class="btn">Click me</button>
        <span class="counter">0</span>
      </div>
    `

    // Act: Query and interact
    const button = document.querySelector('.btn')
    const counter = document.querySelector('.counter')

    button?.click()
    counter!.textContent = '1'

    // Assert: Verify changes
    expect(counter?.textContent).toBe('1')
    expect(button?.classList.contains('btn')).toBe(true)
  })

  test('should handle element attributes', () => {
    document.body.innerHTML = `<input type="text" data-testid="name-input" />`

    const input = document.querySelector('[data-testid="name-input"]')
    expect(input?.getAttribute('type')).toBe('text')

    input?.setAttribute('value', 'John')
    expect(input?.getAttribute('value')).toBe('John')
  })
})
```

### Testing DOM Events

```typescript
/// <reference lib="dom" />

import { test, expect, describe } from 'bun:test'

describe('DOM Events', () => {
  test('should handle click events', () => {
    let clicked = false

    document.body.innerHTML = '<button id="action-btn">Action</button>'
    const button = document.getElementById('action-btn')

    button?.addEventListener('click', () => {
      clicked = true
    })

    button?.click()

    expect(clicked).toBe(true)
  })

  test('should handle custom events', () => {
    const events: string[] = []

    document.body.innerHTML = '<div id="container"></div>'
    const container = document.getElementById('container')

    container?.addEventListener('custom-event', (e: Event) => {
      events.push((e as CustomEvent).detail.message)
    })

    const event = new CustomEvent('custom-event', {
      detail: { message: 'Hello from custom event' },
    })
    container?.dispatchEvent(event)

    expect(events).toContain('Hello from custom event')
  })

  test('should handle input events', () => {
    document.body.innerHTML = '<input id="text-input" />'
    const input = document.getElementById('text-input') as HTMLInputElement

    let inputValue = ''
    input.addEventListener('input', (e) => {
      inputValue = (e.target as HTMLInputElement).value
    })

    input.value = 'test value'
    input.dispatchEvent(new Event('input'))

    expect(inputValue).toBe('test value')
  })
})
```
