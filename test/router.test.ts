/* eslint-disable no-undef */
import { describe, it, expect, beforeEach } from 'bun:test'
import { Router } from '../src/web/router/router.ts'
import { securityHeaders, JsonResponse } from '../src/web/router/middleware.ts'

describe('Router', () => {
  let router: Router

  beforeEach(() => {
    router = new Router()
  })

  it('should handle basic routes', async () => {
    router.get('/test', () => new JsonResponse({ message: 'test' }))

    const req = new Request('http://localhost/test')
    const response = await router.handle(req)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.message).toBe('test')
  })

  it('should handle route parameters', async () => {
    router.get('/users/:id', (_url, _req, ctx) => {
      return new JsonResponse({ userId: ctx.params.id })
    })

    const req = new Request('http://localhost/users/123')
    const response = await router.handle(req)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.userId).toBe('123')
  })

  it('should handle query parameters', async () => {
    router.get('/search', (_url, _req, ctx) => {
      return new JsonResponse({ query: ctx.query.q })
    })

    const req = new Request('http://localhost/search?q=test')
    const response = await router.handle(req)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.query).toBe('test')
  })

  it('should return 404 for unknown routes', async () => {
    const req = new Request('http://localhost/unknown')
    const response = await router.handle(req)

    expect(response.status).toBe(404)
  })

  it('should apply middleware', async () => {
    router.use(securityHeaders)
    router.get('/test', () => new JsonResponse({ message: 'test' }))

    const req = new Request('http://localhost/test')
    const response = await router.handle(req)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('should handle different HTTP methods', async () => {
    router.post('/users', () => new JsonResponse({ message: 'created' }, 201))
    router.get('/users', () => new JsonResponse({ message: 'list' }))

    const postReq = new Request('http://localhost/users', { method: 'POST' })
    const postResponse = await router.handle(postReq)

    const getReq = new Request('http://localhost/users', { method: 'GET' })
    const getResponse = await router.handle(getReq)

    expect(postResponse.status).toBe(201)
    expect(getResponse.status).toBe(200)

    const postData = await postResponse.json()
    const getData = await getResponse.json()
    expect(postData.message).toBe('created')
    expect(getData.message).toBe('list')
  })

  it('should handle complex route parameters', async () => {
    router.get('/users/:userId/posts/:postId', (_url, _req, ctx) => {
      return new JsonResponse({
        userId: ctx.params.userId,
        postId: ctx.params.postId,
      })
    })

    const req = new Request('http://localhost/users/123/posts/456')
    const response = await router.handle(req)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.userId).toBe('123')
    expect(data.postId).toBe('456')
  })
})
