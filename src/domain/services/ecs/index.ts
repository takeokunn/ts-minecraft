// Archetype Query Service
export {
  EntityId,
  ComponentName,
  ComponentData,
  Entity,
  ArchetypeSignature,
  Archetype,
  QueryMetrics,
  ArchetypeError,
  QueryError,
  ArchetypeService,
  ArchetypeServiceLive,
  QueryService,
  QueryServiceLive,
  createQuery,
  parallelQueries,
  batchQuery,
} from './archetype-query.service'

export type {
  EntityId as EntityIdType,
  ComponentName as ComponentNameType,
  ComponentData as ComponentDataType,
  Entity as EntityType,
  ArchetypeSignature as ArchetypeSignatureType,
  Archetype as ArchetypeType,
  QueryMetrics as QueryMetricsType,
} from './archetype-query.service'

// Component Service
export {
  ComponentMetadata,
  ComponentRegistry,
  ComponentPool,
  ComponentError,
  ComponentValidationError,
  ComponentService,
  ComponentServiceLive,
  ComponentPoolService,
  ComponentPoolServiceLive,
  componentBuilder,
  batchRegister,
  validateComponents,
  ComponentSystemLive,
} from './component.service'

export type {
  ComponentMetadata as ComponentMetadataType,
  ComponentRegistry as ComponentRegistryType,
  ComponentPool as ComponentPoolType,
} from './component.service'

// ECS System Layer
export { ECSSystemLive } from './ecs-system-layer'

// Optimized Query Service
export {
  IndexType,
  Index,
  QueryOptimization,
  ExecutionPlan,
  IndexService,
  QueryOptimizerService,
  ParallelQueryExecutor,
  IndexServiceLive,
  QueryOptimizerServiceLive,
  ParallelQueryExecutorLive,
  OptimizedQuerySystemLive,
  queryMetrics,
  withMetrics,
  createOptimizedQuery,
} from './optimized-query.service'

export type {
  IndexType as IndexTypeType,
  Index as IndexType,
  QueryOptimization as QueryOptimizationType,
  ExecutionPlan as ExecutionPlanType,
} from './optimized-query.service'

// Query Builder Service
export {
  QueryOperator,
  QueryCondition,
  QueryNode,
  QueryExpression,
  QueryPlan,
  QueryBuilderService,
  QueryBuilderServiceLive,
  query,
  find,
  exclude,
  spatialQuery,
  tagQuery,
  hierarchyQuery,
} from './query-builder.service'

export type {
  QueryOperator as QueryOperatorType,
  QueryCondition as QueryConditionType,
  QueryNode as QueryNodeType,
  QueryExpression as QueryExpressionType,
  QueryPlan as QueryPlanType,
  QueryBuilder,
  CompiledQuery,
} from './query-builder.service'
