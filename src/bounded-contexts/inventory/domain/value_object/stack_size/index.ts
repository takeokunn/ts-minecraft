// Types
export type {
  MaxStackSize,
  SplitResult,
  StackConstraint,
  StackOperation,
  StackOperationResult,
  StackSize,
  StackSizeError,
  StackStats,
  StackabilityResult,
} from './types'

// Constructors
export { StackOperation, StackOperationResult, StackSizeError, StackabilityResult } from './types'

// Schemas
export {
  CategoryConstraintSchemas,
  MaxStackSizeSchema,
  SpecialStackSchemas,
  SplitResultSchema,
  StackConstraintSchema,
  StackOperationResultSchema,
  StackOperationSchema,
  StackSizeSchema,
  StackStatsSchema,
  StackabilityResultSchema,
} from './schema'

// Constraints
export {
  STACK_CONSTRAINTS,
  getDefaultStackConstraint,
  getItemsByCategory,
  getItemsByStackSize,
  getMaxStackSize,
  getStackConstraint,
  getStackConstraintStats,
  getStackableItems,
  isStackable,
} from './constraints'

// Operations
export {
  addToStack,
  calculateStackStats,
  canStack,
  compareStackSizes,
  createMaxStackSize,
  createStackSize,
  executeStackOperation,
  getAvailableCapacity,
  isEmpty,
  isFull,
  mergeMultipleStacks,
  mergeStacks,
  optimizeStacks,
  removeFromStack,
  splitIntoMultiple,
  splitStack,
} from './operations'
