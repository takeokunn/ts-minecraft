const LEVEL_2_XP_THRESHOLD = 6
const LEVEL_3_XP_THRESHOLD = 14
const LEVEL_4_XP_THRESHOLD = 28

export const villagerLevelFromExperience = (experience: number): number => {
  if (experience >= LEVEL_4_XP_THRESHOLD) {
    return 4
  }

  if (experience >= LEVEL_3_XP_THRESHOLD) {
    return 3
  }

  if (experience >= LEVEL_2_XP_THRESHOLD) {
    return 2
  }

  return 1
}
