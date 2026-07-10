import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_REGISTRY } from '@ts-minecraft/entity/domain/achievement/achievement-registry'
import { INITIAL_STATISTICS, recordBlockMined, recordDimensionVisited } from '@ts-minecraft/entity/domain/statistics/statistics'
import { renderAchievementsPanelHtml } from './pause-menu-achievements'

describe('renderAchievementsPanelHtml', () => {
  it('lists every registry achievement with name and description', () => {
    const html = renderAchievementsPanelHtml(ACHIEVEMENT_REGISTRY, new Set(), INITIAL_STATISTICS)
    for (const achievement of ACHIEVEMENT_REGISTRY) {
      expect(html).toContain(achievement.name)
      expect(html).toContain(achievement.description)
    }
  })

  it('shows the unlocked count and marks unlocked entries', () => {
    const first = ACHIEVEMENT_REGISTRY[0]!
    const html = renderAchievementsPanelHtml(ACHIEVEMENT_REGISTRY, new Set([first.id]), INITIAL_STATISTICS)
    expect(html).toContain(`Achievements: 1 / ${ACHIEVEMENT_REGISTRY.length}`)
    expect(html).toContain('✔')
  })

  it('shows zero unlocked for a fresh world', () => {
    const html = renderAchievementsPanelHtml(ACHIEVEMENT_REGISTRY, new Set(), INITIAL_STATISTICS)
    expect(html).toContain(`Achievements: 0 / ${ACHIEVEMENT_REGISTRY.length}`)
    expect(html).not.toContain('✔')
  })

  it('renders statistics totals and visited dimensions', () => {
    let stats = recordBlockMined(INITIAL_STATISTICS, 'WOOD')
    stats = recordDimensionVisited(stats, 'nether')
    const html = renderAchievementsPanelHtml(ACHIEVEMENT_REGISTRY, new Set(), stats)
    expect(html).toContain('Blocks mined: 1')
    expect(html).toContain('Mobs defeated: 0')
    expect(html).toContain('Items crafted: 0')
    expect(html).toContain('Deaths: 0')
    expect(html).toContain('Dimensions visited: nether')
  })

  it('falls back to overworld when no dimension travel is recorded', () => {
    const html = renderAchievementsPanelHtml(ACHIEVEMENT_REGISTRY, new Set(), INITIAL_STATISTICS)
    expect(html).toContain('Dimensions visited: overworld')
  })
})
