# TypeScript Patterns: WebSocket and Testing

This document covers specific TypeScript patterns and best practices for modern Bun WebSocket implementations and E2E testing infrastructure.

## Modern Bun WebSocket Type Safety

**Problem**: Bun's WebSocket API evolved to prefer configuration-based typing over generics, but many codebases still use outdated patterns.

**Solution**: Configure WebSocket data explicitly in the server setup:

```typescript
Bun.serve({
  websocket: {
    data: undefined as undefined, // For no data - strictest safety
    // or data: {} as unknown,      // For future flexibility
    // or data: undefined as never,  // For maximum strictness
    message: handleWebSocketMessage,
    // ... other handlers
  },
})
```

**Benefits**:

- `ws.data` is properly typed at compile time
- Prevents accidental property access on non-existent data
- Clear contract for WebSocket data requirements
- Future-proof when data needs are added

## TypeScript Module Augmentation for Global Objects

**Problem**: Using `(window as any)` to expose properties for E2E testing bypassed type checking and created maintenance burdens.

**Solution**: Implemented global interface augmentation:

```typescript
declare global {
  interface Window {
    xtermTerminal?: Terminal
    xtermSerializeAddon?: SerializeAddon
  }
}
```

**Benefits**:

- Compile-time type checking for global properties
- Better IDE autocompletion and error detection
- Cleaner, more maintainable code without runtime type assertions
- Zero runtime performance impact

## Handling Private Properties in Type-Safe Code

**Challenge**: Accessing private `_terminal` property on SerializeAddon required type compromises.

**Approach**: Used targeted `as any` casting for private API access:

```typescript
const term = window.xtermSerializeAddon && (window.xtermSerializeAddon as any)._terminal
```

**Rationale**: Private properties are implementation details; `any` is acceptable for controlled, documented access in test utilities.

## Test Synchronization After Type Changes

**Issue**: E2E tests experienced timeouts after component changes, despite passing unit tests.

**Root Cause**: Test helpers relied on `window` properties being set synchronously, but component mounting is asynchronous in React apps.

**Solution**: Added explicit waits for global properties:

```typescript
await page.waitForFunction(() => window.xtermSerializeAddon !== undefined, { timeout: 10000 })
```

**Lesson**: Type changes can affect test timing; always verify E2E test stability after modifications.

## Balancing Type Safety with Practicality

**Insight**: Not all `any` usage should be eliminated—some serve legitimate purposes:

- Test utilities accessing dynamic properties
- Private API interactions
- Legacy code with complex type relationships

**Best Practice**: Eliminate `any` in application code while allowing targeted use in tests and utilities with clear documentation.
