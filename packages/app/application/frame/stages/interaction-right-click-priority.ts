export const RIGHT_CLICK_PRIORITY_EXECUTABLE_STEP_NAMES = [
  'shearAnimal',
  'feedAnimal',
  'consumeFood',
  'farm',
  'bucket',
  'ignite',
] as const

export type RightClickPriorityExecutableStepName = (typeof RIGHT_CLICK_PRIORITY_EXECUTABLE_STEP_NAMES)[number]
