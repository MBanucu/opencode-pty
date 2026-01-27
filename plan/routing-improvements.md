# Routing Improvements Plan for server.ts

## Current Issues Identified

### 1. Mixed Routing Approaches

The server uses three different routing methods:

- Simple routes array for basic routes (`/`, `/health`)
- Manual regex matching in `handleAPISessions` for API routes
- Static asset handling as a fallback

### 2. Scattered Route Logic

API routes are buried in `handlers/api.ts` with complex regex matching, making them hard to maintain and extend.

### 3. Inconsistent Error Handling

Different handlers use different error response patterns.

### 4. No Route Parameters Support

Current system doesn't support clean URL parameters (e.g., `/api/sessions/:id`).

## Proposed Improvements

### 1. Unified Router Class

Create a simple but powerful router that supports:

- Route parameters (`/api/sessions/:id`)
- HTTP method matching
- Middleware support
- Consistent error handling

### 2. Route Registration System

Move all route definitions to a centralized, declarative structure:

```typescript
// Instead of scattered handlers, have:
const routes = [
  { method: 'GET', path: '/', handler: handleRoot },
  { method: 'GET', path: '/health', handler: handleHealth },
  { method: 'GET', path: '/api/sessions', handler: handleGetSessions },
  { method: 'POST', path: '/api/sessions', handler: handleCreateSession },
  { method: 'GET', path: '/api/sessions/:id', handler: handleGetSession },
  // ... etc
]
```

### 3. Parameter Extraction

Clean parameter extraction instead of regex matching:

```typescript
// Instead of: const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/)
// Use: const { id } = req.params
```

### 4. Middleware Pipeline

Add support for common middleware like:

- CORS handling
- Security headers
- Request logging
- Error handling

### 5. Simplified Handler Structure

Refactor handlers to be more focused and consistent:

- Each handler handles one specific route
- Consistent parameter passing
- Standardized error responses

## Implementation Strategy

### Phase 1: Create Router Infrastructure

- Build a simple `Router` class with parameter support
- Add route registration and matching logic
- Implement middleware support

### Phase 2: Migrate Existing Routes

- Move all routes from `handleAPISessions` to the new router
- Refactor handlers to use the new parameter system
- Maintain backward compatibility during transition

### Phase 3: Cleanup and Optimization

- Remove old routing code
- Consolidate error handling
- Add route validation and documentation

## Benefits

1. **Maintainability**: All routes in one place with clear structure
2. **Extensibility**: Easy to add new routes with parameters
3. **Consistency**: Uniform error handling and response patterns
4. **Readability**: Clean, declarative route definitions
5. **Performance**: More efficient route matching

## Current Route Analysis

### Existing Routes Structure

#### Simple Routes (routes array)

- `GET /` → `handleRoot()`
- `GET /health` → `handleHealth(wsClients.size)`

#### API Routes (in handleAPISessions)

- `GET /api/sessions` → List all sessions
- `POST /api/sessions` → Create new session
- `POST /api/sessions/clear` → Clear all sessions
- `GET /api/sessions/:id` → Get specific session
- `POST /api/sessions/:id/input` → Send input to session
- `POST /api/sessions/:id/kill` → Kill session
- `GET /api/sessions/:id/buffer/raw` → Get raw buffer
- `GET /api/sessions/:id/buffer/plain` → Get plain buffer

#### Static Assets

- `GET /assets/*` → Static file serving

## Questions for Decision Making

### 1. Router Complexity

Would you prefer a simple custom router (as outlined) or integrate a lightweight framework like `hono` or `itty-router`?

### 2. Backward Compatibility

Do you need to maintain the current API structure during migration, or can we make breaking changes?

### 3. Middleware Priority

What middleware features are most important?

- CORS handling
- Request logging
- Security headers
- Rate limiting
- Authentication

### 4. Route Organization

Should we organize routes by feature (sessions, health, static) or keep them flat?

## File Structure After Implementation

```
src/web/
├── server.ts (simplified, uses router)
├── router/
│   ├── router.ts (Router class)
│   ├── middleware.ts (common middleware)
│   └── routes.ts (route definitions)
├── handlers/
│   ├── sessions.ts (session-related handlers)
│   ├── health.ts (health handler)
│   └── static.ts (static asset handler)
└── types.ts (updated types)
```

## Implementation Timeline

- **Phase 1**: ✅ COMPLETED - Router infrastructure
  - ✅ Created Router class with parameter support
  - ✅ Implemented middleware pipeline
  - ✅ Built route registration system
  - ✅ Added comprehensive tests
- **Phase 2**: 2-3 days (Route migration)
- **Phase 3**: 1 day (Cleanup and optimization)

Total estimated time: 4-6 days

## Phase 1 Implementation Details

### Files Created

- `src/web/router/router.ts` - Core Router class
- `src/web/router/middleware.ts` - Common middleware functions
- `src/web/router/routes.ts` - Route registration structure
- `src/web/router/index.ts` - Clean exports
- `test/router.test.ts` - Router functionality tests

### Key Features Implemented

- **Parameter Support**: Routes like `/api/sessions/:id` work automatically
- **Middleware Pipeline**: Security headers, CORS, logging, rate limiting
- **Clean API**: Simple route registration methods (`get`, `post`, etc.)
- **Error Handling**: Proper 404 and 500 responses
- **Type Safety**: Full TypeScript support with proper types

### Test Coverage

- Basic route handling
- Route parameters extraction
- Query parameter parsing
- Middleware application
- HTTP method routing
- Complex parameter patterns
