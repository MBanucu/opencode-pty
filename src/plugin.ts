import logger, { initLogger } from './plugin/logger.ts'
import type { PluginContext, PluginResult } from './plugin/types.ts'
import { initManager, manager } from './plugin/pty/manager.ts'
import { initPermissions } from './plugin/pty/permissions.ts'
import { ptySpawn } from './plugin/pty/tools/spawn.ts'
import { ptyWrite } from './plugin/pty/tools/write.ts'
import { ptyRead } from './plugin/pty/tools/read.ts'
import { ptyList } from './plugin/pty/tools/list.ts'
import { ptyKill } from './plugin/pty/tools/kill.ts'
import { ptyServerUrl } from './plugin/pty/tools/server-url.ts'
import { startWebServer } from './web/server.ts'

const log = logger.child({ service: 'pty.plugin' })

export const PTYPlugin = async ({ client, directory }: PluginContext): Promise<PluginResult> => {
  initLogger(client)
  initPermissions(client, directory)
  initManager(client)

  const webServerUrl = startWebServer()
  log.info({ webServerUrl }, 'PTY plugin initialized')

  // Register the /server-url slash command
  try {
    const response = await client.config.get()
    if (response.error) {
      throw new Error(String(response.error))
    }
    if (!response.data) {
      throw new Error('No config data received')
    }
    const currentCommands = response.data.command || {}
    const updatedCommands = {
      ...currentCommands,
      'server-url': {
        template:
          'Get the URL of the running PTY web server instance by calling the pty_server_url tool and display it.',
        description: 'Get the link to the running PTY web server',
      },
    }
    await client.config.update({
      body: {
        command: updatedCommands,
      },
    })
    log.info('Registered /server-url slash command')
  } catch (error) {
    log.warn({ error: String(error) }, 'Failed to register /server-url slash command')
  }

  return {
    tool: {
      pty_spawn: ptySpawn,
      pty_write: ptyWrite,
      pty_read: ptyRead,
      pty_list: ptyList,
      pty_kill: ptyKill,
      pty_server_url: ptyServerUrl,
    },
    event: async ({ event }) => {
      if (!event) {
        return
      }

      if (event.type === 'session.deleted') {
        const sessionId = (event as { properties: { info: { id: string } } }).properties?.info?.id
        if (sessionId) {
          log.info({ sessionId }, 'cleaning up PTYs for deleted session')
          manager.cleanupBySession(sessionId)
        }
      }
    },
  }
}
