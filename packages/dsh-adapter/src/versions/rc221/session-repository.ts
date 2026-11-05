import {
  AppError,
  type BackendEvent,
  type MessageImageReference,
  type SessionDetail,
  type SessionHistoryPage,
  type SessionHistoryQueryOptions,
} from '@dsh-vscode/domain'
import { validAttachmentReference } from '../../repositories/session/responses.js'
import { Alpha212SessionRepository } from '../alpha212/session-repository.js'

// Host-only, bounded references observed in this connection's Session events.
const MAX_IMAGE_REFERENCES = 10_000

/**
 * 0.2.2's SessionAttachmentRequest requires the full ImageAttachmentRef and
 * does not verify that it belongs to the supplied Session. Reconstruct it only
 * from Session events read by this Host, never from a Webview-supplied ID alone.
 */
export class Rc221SessionRepository extends Alpha212SessionRepository {
  private readonly imageReferences = new Map<
    string,
    { readonly sessionId: string; readonly image: MessageImageReference }
  >()

  public override remember(event: BackendEvent): void {
    super.remember(event)
    if (event.type === 'session.removed') {
      for (const [key, reference] of this.imageReferences) {
        if (reference.sessionId === event.sessionId) this.imageReferences.delete(key)
      }
      return
    }
    this.rememberEventImages(event)
  }

  public override async get(sessionId: string, signal?: AbortSignal): Promise<SessionDetail> {
    const detail = await super.get(sessionId, signal)
    for (const row of detail.history ?? []) this.rememberEventImages(row.event)
    return detail
  }

  public override async history(
    sessionId: string,
    beforeSequence?: number,
    signal?: AbortSignal,
    options?: SessionHistoryQueryOptions,
  ): Promise<SessionHistoryPage> {
    const page = await super.history(sessionId, beforeSequence, signal, options)
    for (const row of page.events) this.rememberEventImages(row.event)
    return page
  }

  protected override attachmentRequest(
    sessionId: string,
    attachmentId: string,
  ): Readonly<Record<string, unknown>> {
    const key = JSON.stringify([sessionId, attachmentId])
    const entry = this.imageReferences.get(key)
    if (entry === undefined)
      throw new AppError({
        code: 'STALE_INTERACTION',
        message: 'The requested image is not present in the observed session history.',
        retryable: true,
      })
    // Refresh the bounded cache when a visible image is read again.
    this.imageReferences.delete(key)
    this.imageReferences.set(key, entry)
    return { sessionId, attachment: { ...entry.image } }
  }

  private rememberEventImages(event: BackendEvent): void {
    let images: readonly MessageImageReference[] = []
    if (event.type === 'message.user' || event.type === 'message.completed') images = event.images ?? []
    else if (event.type === 'tool.updated') images = event.tool.images ?? []
    else if (event.type === 'queue.updated') images = event.items.flatMap((item) => item.images ?? [])
    else return
    for (const image of images) {
      if (!validAttachmentReference({ ...image }, image.attachmentId)) continue
      const key = JSON.stringify([event.sessionId, image.attachmentId])
      this.imageReferences.delete(key)
      this.imageReferences.set(key, { sessionId: event.sessionId, image: { ...image } })
      if (this.imageReferences.size > MAX_IMAGE_REFERENCES) {
        const oldest = this.imageReferences.keys().next().value
        if (oldest !== undefined) this.imageReferences.delete(oldest)
      }
    }
  }
}
