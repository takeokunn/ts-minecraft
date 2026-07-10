import type { Achievement } from '@ts-minecraft/entity/domain/achievement/achievement'
import type { Statistics } from '@ts-minecraft/entity/domain/statistics/statistics'

// Pure HTML builder for the pause-menu Achievements panel — kept free of DOM
// APIs so the list/summary layout is unit-testable. All dynamic text is either
// from the trusted achievement registry or numeric, so interpolation is safe.
export const renderAchievementsPanelHtml = (
  registry: ReadonlyArray<Achievement>,
  unlockedIds: ReadonlySet<string>,
  stats: Statistics,
): string => {
  const unlockedCount = registry.filter((a) => unlockedIds.has(a.id)).length
  const rows = registry
    .map((achievement) => {
      const unlocked = unlockedIds.has(achievement.id)
      const marker = unlocked ? '✔' : '·'
      const color = unlocked ? '#2a6a2a' : '#555'
      const nameStyle = unlocked ? 'font-weight:bold' : 'font-weight:bold;opacity:0.65'
      return `<li style="display:flex;gap:8px;align-items:baseline;margin:0 0 6px">
        <span aria-hidden="true" style="color:${color};font-weight:bold">${marker}</span>
        <span style="flex:1"><span style="${nameStyle}">${achievement.name}</span>
        <span style="display:block;font-size:12px;opacity:0.8">${achievement.description}</span></span>
      </li>`
    })
    .join('')
  return `
    <p style="margin:0 0 8px"><strong>Achievements: ${unlockedCount} / ${registry.length}</strong></p>
    <ul style="list-style:none;margin:0 0 10px;padding:0;max-height:220px;overflow-y:auto">${rows}</ul>
    <p style="margin:0 0 4px"><strong>Statistics</strong></p>
    <ul style="list-style:none;margin:0;padding:0;font-size:12px;line-height:1.5">
      <li>Blocks mined: ${stats.blocksMinedTotal}</li>
      <li>Mobs defeated: ${stats.mobsKilledTotal}</li>
      <li>Items crafted: ${stats.itemsCraftedTotal}</li>
      <li>Deaths: ${stats.deathsTotal}</li>
      <li>Dimensions visited: ${stats.dimensionsVisited.length === 0 ? 'overworld' : stats.dimensionsVisited.join(', ')}</li>
    </ul>
  `
}
