import { tool } from '@opencode-ai/plugin'
import { manager } from '../manager.ts'
import { DEFAULT_READ_LIMIT, MAX_LINE_LENGTH } from '../../constants.ts'
import { buildSessionNotFoundError } from '../utils.ts'
import { formatLine } from '../formatters.ts'
import DESCRIPTION from './read.txt'

/**
 * Validates and creates a RegExp from pattern string
 */
function validateAndCreateRegex(pattern: string, ignoreCase?: boolean): RegExp {
  if (!validateRegex(pattern)) {
    throw new Error(
      `Potentially dangerous regex pattern rejected: '${pattern}'. Please use a safer pattern.`
    )
  }

  try {
    return new RegExp(pattern, ignoreCase ? 'i' : '')
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    throw new Error(`Invalid regex pattern '${pattern}': ${error}`)
  }
}

/**
 * Handles pattern-based reading and formatting
 */
function handlePatternRead(args: any, session: any, offset: number, limit: number): string {
  const regex = validateAndCreateRegex(args.pattern, args.ignoreCase)

  const result = manager.search(args.id, regex, offset, limit)
  if (!result) {
    throw buildSessionNotFoundError(args.id)
  }

  if (result.matches.length === 0) {
    return [
      `<pty_output id="${args.id}" status="${session.status}" pattern="${args.pattern}">`,
      `No lines matched the pattern '${args.pattern}'.`,
      `Total lines in buffer: ${result.totalLines}`,
      `</pty_output>`,
    ].join('\n')
  }

  const formattedLines = result.matches.map((match) =>
    formatLine(match.text, match.lineNumber, MAX_LINE_LENGTH)
  )

  const output = [
    `<pty_output id="${args.id}" status="${session.status}" pattern="${args.pattern}">`,
    ...formattedLines,
    '',
  ]

  if (result.hasMore) {
    output.push(
      `(${result.matches.length} of ${result.totalMatches} matches shown. Use offset=${offset + result.matches.length} to see more.)`
    )
  } else {
    output.push(
      `(${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'} from ${result.totalLines} total lines)`
    )
  }
  output.push(`</pty_output>`)

  return output.join('\n')
}

/**
 * Handles plain reading and formatting
 */
function handlePlainRead(args: any, session: any, offset: number, limit: number): string {
  const result = manager.read(args.id, offset, limit)
  if (!result) {
    throw buildSessionNotFoundError(args.id)
  }

  if (result.lines.length === 0) {
    return [
      `<pty_output id="${args.id}" status="${session.status}">`,
      `(No output available - buffer is empty)`,
      `Total lines: ${result.totalLines}`,
      `</pty_output>`,
    ].join('\n')
  }

  const formattedLines = result.lines.map((line, index) =>
    formatLine(line, result.offset + index + 1, MAX_LINE_LENGTH)
  )

  const output = [`<pty_output id="${args.id}" status="${session.status}">`, ...formattedLines]

  if (result.hasMore) {
    output.push('')
    output.push(
      `(Buffer has more lines. Use offset=${result.offset + result.lines.length} to read beyond line ${result.offset + result.lines.length})`
    )
  } else {
    output.push('')
    output.push(`(End of buffer - total ${result.totalLines} lines)`)
  }
  output.push(`</pty_output>`)

  return output.join('\n')
}

/**
 * Formats a single line with line number and truncation
 */
function validateRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    // Check for potentially dangerous patterns that can cause exponential backtracking
    // This is a basic check - more sophisticated validation could be added
    const dangerousPatterns = [
      /\(\?:.*\)\*.*\(\?:.*\)\*/, // nested optional groups with repetition
      /.*\(\.\*\?\)\{2,\}.*/, // overlapping non-greedy quantifiers
      /.*\(.*\|.*\)\{3,\}.*/, // complex alternation with repetition
    ]
    return !dangerousPatterns.some((dangerous) => dangerous.test(pattern))
  } catch {
    return false
  }
}

export const ptyRead = tool({
  description: DESCRIPTION,
  args: {
    id: tool.schema.string().describe('The PTY session ID (e.g., pty_a1b2c3d4)'),
    offset: tool.schema
      .number()
      .optional()
      .describe(
        'Line number to start reading from (0-based, defaults to 0). When using pattern, this applies to filtered matches.'
      ),
    limit: tool.schema
      .number()
      .optional()
      .describe(
        'Number of lines to read (defaults to 500). When using pattern, this applies to filtered matches.'
      ),
    pattern: tool.schema
      .string()
      .optional()
      .describe(
        'Regex pattern to filter lines. When set, only matching lines are returned, then offset/limit apply to the matches.'
      ),
    ignoreCase: tool.schema
      .boolean()
      .optional()
      .describe('Case-insensitive pattern matching (default: false)'),
  },
  async execute(args) {
    const session = manager.get(args.id)
    if (!session) {
      throw buildSessionNotFoundError(args.id)
    }

    const offset = args.offset ?? 0
    const limit = args.limit ?? DEFAULT_READ_LIMIT

    if (args.pattern) {
      return handlePatternRead(args, session, offset, limit)
    } else {
      return handlePlainRead(args, session, offset, limit)
    }
  },
})
