import { Layer } from 'effect'
import {
  GenerationValidatorService,
  makeGenerationValidatorService,
} from '@mc/bc-world/domain/domain_service/world_validation/generation-validator'
import {
  ConsistencyCheckerService,
  makeConsistencyCheckerService,
} from '@mc/bc-world/domain/domain_service/world_validation/consistency-checker'
import {
  ConstraintEnforcerService,
  makeConstraintEnforcerService,
} from '@mc/bc-world/domain/domain_service/world_validation/constraint-enforcer'

export const GenerationValidatorLayer = Layer.succeed(
  GenerationValidatorService,
  makeGenerationValidatorService(),
)
export const ConsistencyCheckerLayer = Layer.succeed(
  ConsistencyCheckerService,
  makeConsistencyCheckerService(),
)
export const ConstraintEnforcerLayer = Layer.succeed(
  ConstraintEnforcerService,
  makeConstraintEnforcerService(),
)

export const WorldValidationLayer = Layer.mergeAll(
  GenerationValidatorLayer,
  ConsistencyCheckerLayer,
  ConstraintEnforcerLayer,
)

export const WorldValidationServices = {
  GenerationValidator: GenerationValidatorService,
  ConsistencyChecker: ConsistencyCheckerService,
  ConstraintEnforcer: ConstraintEnforcerService,
} as const
