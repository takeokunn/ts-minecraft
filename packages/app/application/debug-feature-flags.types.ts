// Type aliases and catalog entry type for debug feature flags.
// These are pure type definitions with no runtime dependencies.

export type DebugFeatureFlagGroup = 'rendering' | 'particles' | 'mobs' | 'simulation' | 'ui' | 'world'
export type DebugFeatureBadge = 'danger' | 'reload' | 'perf'

export type DebugFeatureCatalogShape = {
  readonly id: string
  readonly group: DebugFeatureFlagGroup
  readonly label: string
  readonly description: string
  readonly badges?: ReadonlyArray<DebugFeatureBadge>
}
