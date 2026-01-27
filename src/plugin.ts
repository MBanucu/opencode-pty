import type { PluginContext, PluginResult } from './plugin/types.ts'
import { initManager, manager } from './plugin/pty/manager.ts'
import { initPermissions } from './plugin/pty/permissions.ts'
import { ptySpawn } from './plugin/pty/tools/spawn.ts'
import { ptyWrite } from './plugin/pty/tools/write.ts'
import { ptyRead } from './plugin/pty/tools/read.ts'
import { ptyList } from './plugin/pty/tools/list.ts'
import { ptyKill } from './plugin/pty/tools/kill.ts'
import { getServerUrl, startWebServer } from './web/server/server.ts'

interface SessionDeletedEvent {
  type: 'session.deleted'
  properties: {
    info: {
      id: string
    }
  }
}
const ptyServerUrlCommand = 'pty-server-url'

export const PTYPlugin = async ({ client, directory }: PluginContext): Promise<PluginResult> => {
  initPermissions(client, directory)
  initManager(client)

  return {
    'command.execute.before': async (input) => {
      if (input.command === ptyServerUrlCommand) {
        const serverUrl = getServerUrl()
        client.session.prompt({
          path: { id: input.sessionID },
          body: {
            parts: [
              {
                type: 'text',
                text: serverUrl
                  ? `PTY Web Server URL: ${serverUrl}`
                  : 'PTY Web Server is not running.',
              },
            ],
            noReply: true,
          },
        })
        throw new Error('Command handled by PTY plugin')
      }
    },
    tool: {
      pty_spawn: ptySpawn,
      pty_write: ptyWrite,
      pty_read: ptyRead,
      pty_list: ptyList,
      pty_kill: ptyKill,
    },
    config: async (input) => {
      if (!input.command) {
        input.command = {}
      }
      const serverUrl = await startWebServer()
      input.command[ptyServerUrlCommand] = {
        template: `${serverUrl}`,
        description: 'print link to PTY web server',
      }
    },
    event: async ({ event }) => {
      if (!event) {
        return
      }

      if (event.type === 'session.deleted') {
        const sessionEvent = event as SessionDeletedEvent
        const sessionId = sessionEvent.properties?.info?.id
        if (sessionId) {
          manager.cleanupBySession(sessionId)
        }
      }
    },
  }
}
