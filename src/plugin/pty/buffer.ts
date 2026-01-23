import { DEFAULT_MAX_BUFFER_LINES } from '../../shared/constants.ts'

const DEFAULT_MAX_LINES = parseInt(
  process.env.PTY_MAX_BUFFER_LINES || DEFAULT_MAX_BUFFER_LINES.toString(),
  10
)

export interface SearchMatch {
  lineNumber: number
  text: string
}

export class RingBuffer {
  private lines: string[] = []
  private maxLines: number
  private currentLine: string = ''

  constructor(maxLines: number = DEFAULT_MAX_LINES) {
    this.maxLines = maxLines
  }

  append(data: string): void {
    // Accumulate data, splitting on newlines
    let remaining = data
    let newlineIndex

    while ((newlineIndex = remaining.indexOf('\n')) !== -1) {
      // Add everything up to the newline to the current line
      this.currentLine += remaining.substring(0, newlineIndex)
      // Store the completed line
      this.lines.push(this.currentLine)
      // Reset current line for next accumulation
      this.currentLine = ''
      // Continue with remaining data
      remaining = remaining.substring(newlineIndex + 1)

      // Maintain max lines limit
      if (this.lines.length > this.maxLines) {
        this.lines.shift()
      }
    }

    // Add any remaining data to current line (no newline yet)
    if (remaining) {
      this.currentLine += remaining
    }
  }

  read(offset: number = 0, limit?: number): string[] {
    const start = Math.max(0, offset)
    const end = limit !== undefined ? start + limit : this.lines.length
    return this.lines.slice(start, end)
  }

  search(pattern: RegExp): SearchMatch[] {
    const matches: SearchMatch[] = []
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]
      if (line !== undefined && pattern.test(line)) {
        matches.push({ lineNumber: i + 1, text: line })
      }
    }
    return matches
  }

  get length(): number {
    return this.lines.length
  }

  flush(): void {
    // Flush any remaining incomplete line
    if (this.currentLine) {
      this.lines.push(this.currentLine)
      this.currentLine = ''

      // Maintain max lines limit after flush
      if (this.lines.length > this.maxLines) {
        this.lines.shift()
      }
    }
  }

  clear(): void {
    this.lines = []
    this.currentLine = ''
  }
}
