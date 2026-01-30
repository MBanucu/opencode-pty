import type { PTYSessionInfo } from './types.ts'

export function formatSessionInfo(session: PTYSessionInfo): string[] {
  const exitInfo = session.exitCode !== undefined ? ` (exit: ${session.exitCode})` : ''
  return [
    `[${session.id}] ${session.title}`,
    `  Command: ${session.command} ${session.args.join(' ')}`,
    `  Status: ${session.status}${exitInfo}`,
    `  PID: ${session.pid} | Lines: ${session.lineCount} | Workdir: ${session.workdir}`,
    `  Created: ${session.createdAt}`,
    '',
  ]
}

export function formatLine(line: string, lineNum: number, maxLength: number = 2000): string {
  const lineNumStr = lineNum.toString().padStart(5, '0')
  const truncatedLine = line.length > maxLength ? line.slice(0, maxLength) + '...' : line
  return `${lineNumStr}| ${truncatedLine}`
}
