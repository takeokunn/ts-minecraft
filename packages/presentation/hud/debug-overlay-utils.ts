import type {
  DebugFeatureBadge,
  DebugFeatureCatalogEntry,
  DebugFeatureFlagGroup,
} from '@ts-minecraft/app/application/debug-feature-flags'

export const DOM_UPDATE_INTERVAL_MS = 250

export const facingFromYaw = (yawRad: number): { name: string; axis: string } => {
  let y = yawRad % (2 * Math.PI)
  if (y > Math.PI) y -= 2 * Math.PI
  if (y <= -Math.PI) y += 2 * Math.PI

  const quarter = Math.PI / 4
  if (y >= -quarter && y < quarter) return { name: 'south', axis: 'Towards positive Z' }
  if (y >= quarter && y < 3 * quarter) return { name: 'west', axis: 'Towards negative X' }
  if (y >= -3 * quarter && y < -quarter) return { name: 'east', axis: 'Towards positive X' }
  return { name: 'north', axis: 'Towards negative Z' }
}

export const debugFeatureGroupLabels = {
  rendering: 'Rendering',
  particles: 'Particles',
  mobs: 'Mobs',
  simulation: 'Simulation',
  ui: 'UI',
  world: 'World / Chunks',
} satisfies Record<DebugFeatureFlagGroup, string>

export const DEBUG_FEATURE_GROUP_ORDER = [
  'rendering',
  'particles',
  'mobs',
  'simulation',
  'ui',
  'world',
] as const satisfies ReadonlyArray<DebugFeatureFlagGroup>

export const debugFeatureBadges = (entry: DebugFeatureCatalogEntry): ReadonlyArray<DebugFeatureBadge> =>
  'badges' in entry ? entry.badges : []

export const debugFeatureSearchMatches = (
  entry: DebugFeatureCatalogEntry,
  query: string,
): boolean => {
  const normalized = query.trim().toLowerCase()
  if (normalized.length === 0) return true

  const haystack = [
    entry.id,
    entry.label,
    entry.group,
    debugFeatureGroupLabels[entry.group],
    entry.description,
    ...debugFeatureBadges(entry),
  ].join(' ').toLowerCase()

  return haystack.includes(normalized)
}

export const formatNumber = (n: number, decimals: number): string =>
  Number.isFinite(n) ? n.toFixed(decimals) : '--'

export const badgeStyles: Record<'danger' | 'reload' | 'perf', string> = {
  danger: 'color:#fecaca;border-color:#ef4444;background:rgba(127,29,29,0.55)',
  reload: 'color:#fde68a;border-color:#f59e0b;background:rgba(120,53,15,0.45)',
  perf: 'color:#bae6fd;border-color:#38bdf8;background:rgba(8,47,73,0.45)',
}
