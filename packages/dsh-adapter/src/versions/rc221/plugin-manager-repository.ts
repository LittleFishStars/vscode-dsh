import { Alpha214PluginBundleRepository } from '../alpha214/plugin-manager-repository.js'
import type { PluginManagerWireProfile } from '../rc172/plugin-manager-repository.js'

/** 0.2.2 reports bundles unsupported on the running platform as a management error. */
export class Rc221PluginBundleRepository extends Alpha214PluginBundleRepository {
  protected override readonly wireProfile: PluginManagerWireProfile = {
    restartReason: true,
    alreadyInstalled: true,
    unsupportedPlatform: true,
  }
}
