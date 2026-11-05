import type { BackendEndpoint, ScheduleRepository } from '@dsh-vscode/domain'
import type { VersionAdapterIdentity } from '../../adapter-base.js'
import type { AlphaLoopbackApiClient, AlphaLoopbackApiClientOptions } from '../alpha/transport.js'
import { Rc215VersionAdapter } from '../rc215/adapter.js'

/** dsh-v0.2.2-rc.1 / 66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db. */
export class Rc221VersionAdapter extends Rc215VersionAdapter {
  protected override readonly identity: VersionAdapterIdentity = {
    id: 'dsh-0.2.2-rc.1',
    supportedVersion: '0.2.2-rc.1',
    protocolVersion: 'rc221',
    compatibilityPriority: 360,
    fallback: false,
  }

  protected override createTransportOptions(endpoint: BackendEndpoint): AlphaLoopbackApiClientOptions {
    return { ...super.createTransportOptions(endpoint), controlWireVersion: 'projection-v3' }
  }

  protected override createScheduleRepository(
    _transport: AlphaLoopbackApiClient,
  ): ScheduleRepository | undefined {
    // 0.2.2 moved tasks to a Host-wide contract with different targets and
    // mutation requests. Do not issue the older Session-scoped writes.
    return undefined
  }
}
