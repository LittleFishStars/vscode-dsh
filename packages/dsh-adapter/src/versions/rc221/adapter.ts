import type { BackendEndpoint, PluginBundleRepository, ScheduleRepository } from '@dsh-vscode/domain'
import type { VersionAdapterIdentity } from '../../adapter-base.js'
import type { AlphaLoopbackApiClient, AlphaLoopbackApiClientOptions } from '../alpha/transport.js'
import type { Rc6SessionRepositoryOptions } from '../../repositories/session-repository.js'
import type { Rc6WorkspaceRepository } from '../../repositories/workspace-repository.js'
import { Rc215VersionAdapter } from '../rc215/adapter.js'
import { Rc221SessionRepository } from './session-repository.js'
import { Rc221PluginBundleRepository } from './plugin-manager-repository.js'

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

  protected override createSessionRepository(
    transport: AlphaLoopbackApiClient,
    workspaces: Rc6WorkspaceRepository,
    options: Rc6SessionRepositoryOptions,
  ): Rc221SessionRepository {
    return new Rc221SessionRepository(transport, workspaces, this.options.samePath, options)
  }

  protected override createPluginBundleRepository(transport: AlphaLoopbackApiClient): PluginBundleRepository {
    return new Rc221PluginBundleRepository(transport)
  }

  protected override createScheduleRepository(
    _transport: AlphaLoopbackApiClient,
  ): ScheduleRepository | undefined {
    // 0.2.2 moved tasks to a Host-wide contract with different targets and
    // mutation requests. Do not issue the older Session-scoped writes.
    return undefined
  }
}
