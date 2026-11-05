import { describe, expect, it, vi } from 'vitest'
import type { BackendEvent } from '@dsh-vscode/domain'
import type { DshTransport } from '../src/contracts.js'
import type { Rc6WorkspaceRepository } from '../src/repositories/workspace-repository.js'
import { Rc221SessionRepository } from '../src/versions/rc221/session-repository.js'

// dsh-v0.2.2-rc.1 / 66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db:
// packages/api/session-controller/src/types.ts, SessionAttachmentRequest.
const image = {
  attachmentId: 'image-1',
  mediaType: 'image/png',
  bytes: 8,
  width: 1,
  height: 1,
  name: 'image.png',
} as const
const data = 'iVBORw0KGgo='
const liveEvents: readonly BackendEvent[] = [
  { type: 'message.user', sessionId: 'session-1', messageId: 'message-1', markdown: '', images: [image] },
  { type: 'message.completed', sessionId: 'session-1', messageId: 'message-1', images: [image] },
  {
    type: 'tool.updated',
    sessionId: 'session-1',
    tool: {
      id: 'tool-1',
      name: 'fixture',
      category: 'fixture',
      title: 'Fixture',
      status: 'completed',
      metadata: {},
      images: [image],
    },
  },
  {
    type: 'queue.updated',
    sessionId: 'session-1',
    items: [
      {
        id: 'queue-1',
        sessionId: 'session-1',
        text: '',
        attachments: [],
        textOnly: false,
        mode: 'queue',
        createdAt: '2026-01-01',
        images: [image],
      },
    ],
  },
]

function fixture() {
  const request = vi.fn((method: string) =>
    Promise.resolve({
      result: {
        ok: true,
        value:
          method === 'session.history'
            ? {
                events: [
                  {
                    event: {
                      type: 'user/message',
                      seq: 1,
                      time: 2,
                      data: {
                        id: 'user-1',
                        role: 'user',
                        source: { kind: 'user' },
                        content: [{ type: 'image', attachment: image }],
                      },
                    },
                  },
                ],
                hasMore: false,
              }
            : { attachment: image, data },
      },
    }),
  )
  const transport: DshTransport = {
    request: request as DshTransport['request'],
    remoteRequest: <T>() => Promise.reject<T>(new Error('Unexpected Remote')),
    openEventStream: async function* () {},
    close: async () => {},
  }
  return {
    repository: new Rc221SessionRepository(transport, {} as Rc6WorkspaceRepository, undefined, {}),
    request,
  }
}

describe('DSH 0.2.2-rc.1 historical images', () => {
  it('uses a full reference learned from that session history and validates returned bytes', async () => {
    const { repository, request } = fixture()
    await repository.history('session-1')
    await expect(repository.readAttachment('session-1', image.attachmentId)).resolves.toMatchObject({
      uri: `data:image/png;base64,${data}`,
    })
    expect(request).toHaveBeenLastCalledWith(
      'session.attachment',
      { sessionId: 'session-1', attachment: image },
      undefined,
    )
    await expect(repository.readAttachment('another-session', image.attachmentId)).rejects.toMatchObject({
      code: 'STALE_INTERACTION',
    })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it.each(liveEvents)(
    'records image references from a live $type event and drops them on session removal',
    async (event) => {
      const { repository, request } = fixture()
      repository.remember(event)
      await expect(repository.readAttachment('session-1', image.attachmentId)).resolves.toBeDefined()
      repository.remember({ type: 'session.removed', sessionId: 'session-1' })
      await expect(repository.readAttachment('session-1', image.attachmentId)).rejects.toMatchObject({
        code: 'STALE_INTERACTION',
      })
      expect(request).toHaveBeenCalledTimes(1)
    },
  )
})
