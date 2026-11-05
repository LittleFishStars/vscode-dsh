import { normalizeAlpha171ControlFrame, type Alpha171ControlOutput } from '../alpha171/session-control.js'

/**
 * dsh-v0.2.2-rc.1, packages/api/session-controller/src/types.ts:
 * one committed event publishes its projection changes together. Validate
 * the whole batch before exposing any of it to the older per-key consumers.
 */
export function normalizeRc221ControlFrame(value: unknown): readonly Alpha171ControlOutput[] | undefined {
  const frame = plainRecord(value)
  if (frame?.type === 'baseline') return normalizeAlpha171ControlFrame(value)
  if (
    frame === undefined ||
    !hasExactKeys(frame, ['type', 'sessionId', 'seq', 'changes']) ||
    frame.type !== 'projection' ||
    !Array.isArray(frame.changes) ||
    frame.changes.length === 0
  )
    return undefined

  const keys = new Set<string>()
  const output: Alpha171ControlOutput[] = []
  for (const raw of frame.changes) {
    const change = plainRecord(raw)
    if (
      change === undefined ||
      !hasExactKeys(change, ['key', 'val']) ||
      typeof change.key !== 'string' ||
      change.key.trim() === '' ||
      keys.has(change.key)
    )
      return undefined
    keys.add(change.key)
    const normalized = normalizeAlpha171ControlFrame({
      type: 'projection',
      sessionId: frame.sessionId,
      seq: frame.seq,
      key: change.key,
      value: change.val,
    })
    if (normalized === undefined) return undefined
    output.push(...normalized)
  }
  return output
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const prototype = Reflect.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null ? (value as Record<string, unknown>) : undefined
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value)
  return ownKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
