import { tool } from '@opencode-ai/plugin'
import { getServerUrl } from '../../../web/server/server.ts'
import DESCRIPTION from './server-url.txt'

export const ptyServerUrl = tool({
  description: DESCRIPTION,
  args: {},
  async execute() {
    const url = getServerUrl()
    if (!url) {
      return 'Web server is not running'
    }
    return url
  },
})
