import { Layer } from 'effect'
import {
  AdaptiveQualityService,
  AdaptiveQualityServiceLive,
  LoadingSchedulerService,
  LoadingSchedulerServiceLive,
  makeProgressiveLoadingService,
  MemoryMonitorService,
  MemoryMonitorServiceLive,
  PriorityCalculatorService,
  PriorityCalculatorServiceLive,
  ProgressiveLoadingService,
} from './index'

// === Integrated Layer ===

export const ProgressiveLoadingServiceLive = Layer.effect(
  ProgressiveLoadingService,
  makeProgressiveLoadingService
).pipe(
  Layer.provide(LoadingSchedulerService),
  Layer.provide(PriorityCalculatorService),
  Layer.provide(MemoryMonitorService),
  Layer.provide(AdaptiveQualityService)
)

// === Complete Service Layer ===

export const ProgressiveLoadingServicesLayer = Layer.mergeAll(
  LoadingSchedulerServiceLive,
  PriorityCalculatorServiceLive,
  MemoryMonitorServiceLive,
  AdaptiveQualityServiceLive,
  ProgressiveLoadingServiceLive
)
