#!/usr/bin/env bun
import { startWebServer, stopWebServer } from '../src/web/server.ts'

type Result = { requests: number; totalBytes: number; totalTime: number; indexSize: number }

async function fetchWithTiming(url: string): Promise<{ size: number; time: number }> {
  const t0 = performance.now()
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const t1 = performance.now()
  return { size: buf.byteLength, time: (t1 - t0) / 1000 }
}

function extractAssetsFromHtml(html: string): string[] {
  const assets = new Set<string>()
  // match src="..." and href="..."
  for (const m of html.matchAll(/(?:src|href)=\"([^\"]+)\"/g)) {
    assets.add(m[1])
  }
  return Array.from(assets)
}

function extractImportsFromModule(code: string): string[] {
  const imports = new Set<string>()
  // import ... from "..." and import("...")
  for (const m of code.matchAll(
    /from\s+\"([^\"]+)\"|from\s+'([^']+)'|import\(\s*\"([^\"]+)\"\s*\)|import\(\s*'([^']+)'\s*\)/g
  )) {
    for (let i = 1; i < m.length; i++) {
      if (m[i]) imports.add(m[i])
    }
  }
  // bare import "./foo.js"
  for (const m of code.matchAll(/import\s+\"([^\"]+)\"|import\s+'([^']+)'/g)) {
    if (m[1]) imports.add(m[1])
    if (m[2]) imports.add(m[2])
  }
  return Array.from(imports)
}

async function measure(mode: 'production' | 'test', port = 5173): Promise<Result> {
  console.log('\n--- Measuring', mode, 'mode ---')
  process.env.NODE_ENV = mode
  const url = startWebServer({ port })
  // allow server a moment
  await new Promise((r) => setTimeout(r, 200))

  const indexUrl = `${url}/`
  console.log('Fetching index:', indexUrl)
  const t0 = performance.now()
  const indexRes = await fetch(indexUrl)
  const indexBuf = await indexRes.arrayBuffer()
  const t1 = performance.now()
  const indexSize = indexBuf.byteLength
  const indexTime = (t1 - t0) / 1000

  const html = new TextDecoder().decode(indexBuf)
  const assets = extractAssetsFromHtml(html)

  // For production we care about /assets/* (js/css). For test mode, also fetch module files referenced from main entry.
  const toFetch = new Set<string>()
  for (const a of assets) toFetch.add(a)

  // If test mode, also try fetching /main.tsx and then its imports
  if (mode === 'test') {
    // ensure main.tsx is included
    toFetch.add('/main.tsx')
    // fetch main and parse imports
    try {
      const mainUrl = `${url}/main.tsx`
      const mainT0 = performance.now()
      const mainRes = await fetch(mainUrl)
      const mainBuf = await mainRes.arrayBuffer()
      const mainT1 = performance.now()
      const mainCode = new TextDecoder().decode(mainBuf)
      const imports = extractImportsFromModule(mainCode)
      for (const imp of imports) {
        // Normalize absolute-ish paths to start with /
        if (imp.startsWith('/')) toFetch.add(imp)
        else if (imp.startsWith('./') || imp.startsWith('../')) {
          // create a path relative to / (approximation)
          const cleaned = imp.replace(/^[\.]+\//, '')
          toFetch.add(`/${cleaned}`)
        }
      }
    } catch (err) {
      console.warn('Failed to fetch/parse main.tsx:', String(err))
    }
  }

  // Now fetch each asset sequentially and measure
  let totalBytes = indexSize
  let totalTime = indexTime
  let requests = 1

  for (const path of Array.from(toFetch)) {
    // normalize full URL
    let full = path
    if (!/^https?:\/\//.test(path)) {
      // ensure single leading slash
      const p = path.startsWith('/') ? path : `/${path}`
      full = `${url}${p}`
    }
    try {
      const { size, time } = await fetchWithTiming(full)
      console.log(`fetched ${path} -> ${size} bytes in ${time}s`)
      totalBytes += size
      totalTime += time
      requests++
    } catch (err) {
      console.warn(`failed to fetch ${full}:`, String(err))
    }
  }

  stopWebServer()
  // small delay to allow server to close
  await new Promise((r) => setTimeout(r, 100))

  return { requests, totalBytes, totalTime, indexSize }
}

async function main() {
  const port = Number(process.argv[2] || 5173)
  const dist = await measure('production', port)
  console.log('\nProduction result:', dist)
  const src = await measure('test', port + 1)
  console.log('\nTest (src) result:', src)
  console.log('\nDone')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
