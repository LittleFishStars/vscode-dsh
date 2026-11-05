import { describe, expect, it } from 'vitest'
import type { BackendEndpoint } from '@dsh-vscode/domain'
import { Rc221VersionAdapter } from '../src/versions/rc221/adapter.js'
import { normalizeRc221ControlFrame } from '../src/versions/rc221/session-control.js'
import type { AlphaLoopbackApiClient } from '../src/versions/alpha/transport.js'
import { normalizeAlpha171ControlFrame } from '../src/versions/alpha171/session-control.js'
import { transportOptions } from './support/contract-harness.js'

// dsh-v0.2.2-rc.1 / 66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db:
// packages/api/session-controller/src/types.ts, SessionProjectionUpdate.
const inbox = {
  'next-turn': [
    {
      id: 'message-1',
      role: 'user',
      content: [{ type: 'text', text: 'fixture' }],
      source: { kind: 'user', rpcId: 'request-1' },
    },
  ],
  'next-step': [],
}

describe('DSH 0.2.2-rc.1 Session control', () => {
  it('normalizes all changes at one sequence, including the Inbox queue and request identity', () => {
    const frame = {
      type: 'projection',
      sessionId: 'session-1',
      seq: 12,
      changes: [
        { key: 'title', val: 'Updated' },
        { key: 'inbox', val: inbox },
      ],
    }
    expect(normalizeRc221ControlFrame(frame)).toEqual([
      { type: 'session/projection', sessionId: 'session-1', seq: 12, key: 'title', value: 'Updated' },
      {
        type: 'session/queue',
        sessionId: 'session-1',
        asOfSequence: 12,
        items: [
          {
            id: 'message-1',
            placement: 'queued',
            rpcId: 'request-1',
            message: { id: 'message-1', content: inbox['next-turn'][0]!.content, source: { kind: 'user' } },
          },
        ],
      },
      { type: 'session/projection', sessionId: 'session-1', seq: 12, key: 'inbox', value: inbox },
    ])
    expect(normalizeAlpha171ControlFrame(frame)).toBeUndefined()
  })

  it('retains the existing full baseline contract', () => {
    const baseline = {
      type: 'baseline',
      value: { projections: { 'session-1': { asOfSeq: 11, values: {} } } },
    }
    expect(normalizeRc221ControlFrame(baseline)).toEqual(normalizeAlpha171ControlFrame(baseline))
  })

  it.each([
    { changes: [] },
    {
      changes: [
        { key: 'title', val: 'one' },
        { key: 'title', val: 'two' },
      ],
    },
    {
      changes: [
        { key: 'title', val: 'valid' },
        { key: 'inbox', val: { 'next-turn': [] } },
      ],
    },
    { changes: [{ key: 'title', val: 'valid', unexpected: true }] },
    { changes: [{ key: 'title', val: undefined }] },
    { changes: [{ key: '', val: null }] },
    { seq: -1, changes: [{ key: 'title', val: 'valid' }] },
  ])('rejects a malformed batch without emitting a partial update: %o', (overrides) => {
    expect(
      normalizeRc221ControlFrame({ type: 'projection', sessionId: 'session-1', seq: 12, ...overrides }),
    ).toBeUndefined()
  })

  it('selects the new control wire and withholds the changed Schedule port', () => {
    class InspectableAdapter extends Rc221VersionAdapter {
      public transportProfile(endpoint: BackendEndpoint) {
        return this.createTransportOptions(endpoint)
      }
      public schedule() {
        return this.createScheduleRepository({} as AlphaLoopbackApiClient)
      }
    }
    const adapter = new InspectableAdapter(transportOptions(globalThis.fetch))
    expect(
      adapter.transportProfile({ host: '127.0.0.1', port: 4567, baseUrl: 'http://127.0.0.1:4567' })
        .controlWireVersion,
    ).toBe('projection-v3')
    expect(adapter.schedule()).toBeUndefined()
  })
})
