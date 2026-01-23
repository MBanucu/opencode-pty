// Default buffer size in characters (approximately 1MB)
const DEFAULT_MAX_BUFFER_SIZE = parseInt(process.env.PTY_MAX_BUFFER_SIZE || '1000000', 10)

export interface SearchMatch {
  lineNumber: number
  text: string
}

export class RingBuffer {
  private buffer: string = ''
  private maxSize: number

  constructor(maxSize: number = DEFAULT_MAX_BUFFER_SIZE) {
    this.maxSize = maxSize
  }

  append(data: string): void {
    this.buffer += data
    // Simple byte-level truncation: keep only the last maxSize characters
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize)
    }
  }

  read(offset: number = 0, limit?: number): string[] {
    const lines: string[] = this.buffer.split('\n')
    const start = Math.max(0, offset)
    const end = limit !== undefined ? start + limit : lines.length
    return lines.slice(start, end)
  }

  readRaw(): string {
    return this.buffer
  }

  search(pattern: RegExp): SearchMatch[] {
    const matches: SearchMatch[] = []
    const lines: string[] = this.buffer.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line && pattern.test(line)) {
        matches.push({ lineNumber: i + 1, text: line })
      }
    }
    return matches
  }

  get length(): number {
    return this.buffer.split('\n').length
  }

  get byteLength(): number {
    return this.buffer.length
  }

  flush(): void {
    // No-op in new implementation
  }

  clear(): void {
    this.buffer = ''
  }
}
