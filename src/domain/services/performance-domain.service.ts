/**
 * Performance Domain Service
 * 
 * Contains pure domain logic for performance monitoring, optimization strategies,
 * and alert management. This service defines business rules for performance
 * thresholds and optimization without dependencies on specific monitoring libraries.
 */

import { Effect, Context, Layer } from 'effect'

/**
 * Performance threshold configurations (domain business rules)
 */
export const PERFORMANCE_THRESHOLDS = {
  fps: {
    excellent: 60,
    good: 45,
    acceptable: 30,
    poor: 15,
    critical: 5,
  },
  memory: {
    low: 256 * 1024 * 1024, // 256MB
    moderate: 512 * 1024 * 1024, // 512MB
    high: 1024 * 1024 * 1024, // 1GB
    critical: 2048 * 1024 * 1024, // 2GB
  },
  latency: {
    excellent: 16, // < 16ms for 60fps
    good: 33, // < 33ms for 30fps
    acceptable: 50, // < 50ms
    poor: 100, // < 100ms
    critical: 200, // < 200ms
  },
  cpu: {
    low: 25, // < 25%
    moderate: 50, // < 50%
    high: 75, // < 75%
    critical: 90, // < 90%
  },
} as const

/**
 * Performance category types
 */
export type PerformanceCategory = 'fps' | 'memory' | 'latency' | 'cpu' | 'network' | 'gpu' | 'disk'
export type PerformanceSeverity = 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical'
export type AlertType = 'info' | 'warning' | 'error' | 'critical'

/**
 * Domain-specific performance metrics
 */
export interface PerformanceMetric {
  readonly category: PerformanceCategory
  readonly value: number
  readonly timestamp: number
  readonly severity: PerformanceSeverity
  readonly unit: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Performance alert (domain entity)
 */
export interface PerformanceAlert {
  readonly id: string
  readonly category: PerformanceCategory
  readonly type: AlertType
  readonly severity: PerformanceSeverity
  readonly message: string
  readonly threshold: number
  readonly actualValue: number
  readonly timestamp: number
  readonly resolved: boolean
  readonly resolutionTimestamp?: number
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Performance optimization strategy
 */
export interface OptimizationStrategy {
  readonly id: string
  readonly name: string
  readonly category: PerformanceCategory
  readonly severity: PerformanceSeverity
  readonly description: string
  readonly impact: 'low' | 'medium' | 'high'
  readonly difficulty: 'easy' | 'moderate' | 'hard'
  readonly estimatedImprovement: number
  readonly prerequisites: readonly string[]
  readonly enabled: boolean
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysis {
  readonly overallScore: number // 0-100
  readonly categoryScores: Readonly<Record<PerformanceCategory, number>>
  readonly bottlenecks: readonly PerformanceCategory[]
  readonly recommendedOptimizations: readonly OptimizationStrategy[]
  readonly alerts: readonly PerformanceAlert[]
  readonly summary: string
}

/**
 * Game-specific performance context
 */
export interface GamePerformanceContext {
  readonly entitiesCount: number
  readonly chunksLoaded: number
  readonly chunksVisible: number
  readonly renderDistance: number
  readonly qualityLevel: 'low' | 'medium' | 'high' | 'ultra'
  readonly shaderComplexity: 'basic' | 'standard' | 'advanced'
  readonly playerCount: number
  readonly worldSize: number
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  readonly monitoring: {
    readonly enabled: boolean
    readonly sampleRate: number // Hz
    readonly historyLength: number // samples
    readonly alertingEnabled: boolean
    readonly autoOptimizationEnabled: boolean
  }
  readonly thresholds: {
    readonly fps: typeof PERFORMANCE_THRESHOLDS.fps
    readonly memory: typeof PERFORMANCE_THRESHOLDS.memory
    readonly latency: typeof PERFORMANCE_THRESHOLDS.latency
    readonly cpu: typeof PERFORMANCE_THRESHOLDS.cpu
  }
  readonly optimization: {
    readonly aggressiveMemoryManagement: boolean
    readonly dynamicQualityAdjustment: boolean
    readonly adaptiveLOD: boolean
    readonly intelligentCulling: boolean
  }
}

/**
 * Domain errors
 */
export class PerformanceAnalysisError extends Error {
  readonly _tag = 'PerformanceAnalysisError'
  constructor(public readonly reason: string) {
    super(`Performance analysis failed: ${reason}`)
  }
}

export class PerformanceThresholdViolationError extends Error {
  readonly _tag = 'PerformanceThresholdViolationError'
  constructor(public readonly category: PerformanceCategory, public readonly value: number, public readonly threshold: number) {
    super(`Performance threshold violation: ${category} value ${value} exceeds threshold ${threshold}`)
  }
}

/**
 * Pure domain functions for performance analysis
 */

const calculatePerformanceSeverity = (category: PerformanceCategory, value: number): PerformanceSeverity => {
  switch (category) {
    case 'fps':
      if (value >= PERFORMANCE_THRESHOLDS.fps.excellent) return 'excellent'
      if (value >= PERFORMANCE_THRESHOLDS.fps.good) return 'good'
      if (value >= PERFORMANCE_THRESHOLDS.fps.acceptable) return 'acceptable'
      if (value >= PERFORMANCE_THRESHOLDS.fps.poor) return 'poor'
      return 'critical'
    
    case 'memory':
      if (value <= PERFORMANCE_THRESHOLDS.memory.low) return 'excellent'
      if (value <= PERFORMANCE_THRESHOLDS.memory.moderate) return 'good'
      if (value <= PERFORMANCE_THRESHOLDS.memory.high) return 'acceptable'
      if (value <= PERFORMANCE_THRESHOLDS.memory.critical) return 'poor'
      return 'critical'
    
    case 'latency':
      if (value <= PERFORMANCE_THRESHOLDS.latency.excellent) return 'excellent'
      if (value <= PERFORMANCE_THRESHOLDS.latency.good) return 'good'
      if (value <= PERFORMANCE_THRESHOLDS.latency.acceptable) return 'acceptable'
      if (value <= PERFORMANCE_THRESHOLDS.latency.poor) return 'poor'
      return 'critical'
    
    case 'cpu':
      if (value <= PERFORMANCE_THRESHOLDS.cpu.low) return 'excellent'
      if (value <= PERFORMANCE_THRESHOLDS.cpu.moderate) return 'good'
      if (value <= PERFORMANCE_THRESHOLDS.cpu.high) return 'acceptable'
      if (value <= PERFORMANCE_THRESHOLDS.cpu.critical) return 'poor'
      return 'critical'
    
    default:
      return 'good' // Default for categories without specific thresholds
  }
}

const severityToAlertType = (severity: PerformanceSeverity): AlertType => {
  switch (severity) {
    case 'excellent':
    case 'good':
      return 'info'
    case 'acceptable':
      return 'warning'
    case 'poor':
      return 'error'
    case 'critical':
      return 'critical'
  }
}

const createPerformanceMetric = (
  category: PerformanceCategory,
  value: number,
  timestamp: number = Date.now(),
  metadata?: Readonly<Record<string, unknown>>
): PerformanceMetric => {
  const severity = calculatePerformanceSeverity(category, value)
  
  const units: Record<PerformanceCategory, string> = {
    fps: 'fps',
    memory: 'bytes',
    latency: 'ms',
    cpu: '%',
    network: 'ms',
    gpu: '%',
    disk: 'MB/s',
  }
  
  return {
    category,
    value,
    timestamp,
    severity,
    unit: units[category],
    metadata,
  }
}

const createPerformanceAlert = (
  metric: PerformanceMetric,
  threshold: number
): Effect.Effect<PerformanceAlert, never, never> =>
  Effect.gen(function* () {
    const alertType = severityToAlertType(metric.severity)
    const id = `${metric.category}-${metric.timestamp}`
    
    const messages: Record<PerformanceCategory, (value: number, threshold: number) => string> = {
      fps: (v, t) => `Low frame rate detected: ${v.toFixed(1)} fps (threshold: ${t} fps)`,
      memory: (v, t) => `High memory usage: ${(v / 1024 / 1024).toFixed(1)} MB (threshold: ${(t / 1024 / 1024).toFixed(1)} MB)`,
      latency: (v, t) => `High latency detected: ${v.toFixed(1)} ms (threshold: ${t} ms)`,
      cpu: (v, t) => `High CPU usage: ${v.toFixed(1)}% (threshold: ${t}%)`,
      network: (v, t) => `Network latency: ${v.toFixed(1)} ms (threshold: ${t} ms)`,
      gpu: (v, t) => `High GPU usage: ${v.toFixed(1)}% (threshold: ${t}%)`,
      disk: (v, t) => `High disk I/O: ${v.toFixed(1)} MB/s (threshold: ${t} MB/s)`,
    }
    
    return {
      id,
      category: metric.category,
      type: alertType,
      severity: metric.severity,
      message: messages[metric.category](metric.value, threshold),
      threshold,
      actualValue: metric.value,
      timestamp: metric.timestamp,
      resolved: false,
      metadata: metric.metadata,
    }
  })

const getOptimizationStrategies = (
  context: GamePerformanceContext,
  analysis: PerformanceAnalysis
): readonly OptimizationStrategy[] => {
  const strategies: OptimizationStrategy[] = []
  
  // FPS optimization strategies
  if (analysis.categoryScores.fps < 60) {
    strategies.push({
      id: 'reduce-render-distance',
      name: 'Reduce Render Distance',
      category: 'fps',
      severity: analysis.categoryScores.fps < 30 ? 'critical' : 'poor',
      description: 'Reduce the render distance to improve frame rate',
      impact: 'high',
      difficulty: 'easy',
      estimatedImprovement: 15,
      prerequisites: [],
      enabled: context.renderDistance > 8,
    })
    
    strategies.push({
      id: 'enable-lod',
      name: 'Enable Level of Detail (LOD)',
      category: 'fps',
      severity: 'good',
      description: 'Use lower detail models for distant objects',
      impact: 'medium',
      difficulty: 'moderate',
      estimatedImprovement: 10,
      prerequisites: [],
      enabled: true,
    })
    
    strategies.push({
      id: 'frustum-culling',
      name: 'Implement Frustum Culling',
      category: 'fps',
      severity: 'good',
      description: 'Only render objects within the camera view',
      impact: 'high',
      difficulty: 'moderate',
      estimatedImprovement: 20,
      prerequisites: [],
      enabled: true,
    })
  }
  
  // Memory optimization strategies
  if (analysis.categoryScores.memory > PERFORMANCE_THRESHOLDS.memory.moderate) {
    strategies.push({
      id: 'object-pooling',
      name: 'Implement Object Pooling',
      category: 'memory',
      severity: 'poor',
      description: 'Reuse objects to reduce garbage collection pressure',
      impact: 'high',
      difficulty: 'moderate',
      estimatedImprovement: 25,
      prerequisites: [],
      enabled: true,
    })
    
    strategies.push({
      id: 'texture-compression',
      name: 'Enable Texture Compression',
      category: 'memory',
      severity: 'good',
      description: 'Compress textures to reduce memory usage',
      impact: 'medium',
      difficulty: 'easy',
      estimatedImprovement: 15,
      prerequisites: [],
      enabled: true,
    })
    
    strategies.push({
      id: 'chunk-unloading',
      name: 'Aggressive Chunk Unloading',
      category: 'memory',
      severity: 'good',
      description: 'Unload chunks more aggressively when not visible',
      impact: 'medium',
      difficulty: 'easy',
      estimatedImprovement: 20,
      prerequisites: [],
      enabled: context.chunksLoaded > 100,
    })
  }
  
  // GPU optimization strategies
  if (context.qualityLevel === 'ultra' && analysis.overallScore < 70) {
    strategies.push({
      id: 'reduce-quality',
      name: 'Reduce Graphics Quality',
      category: 'gpu',
      severity: 'acceptable',
      description: 'Lower graphics settings to improve performance',
      impact: 'high',
      difficulty: 'easy',
      estimatedImprovement: 30,
      prerequisites: [],
      enabled: true,
    })
  }
  
  // Entity optimization strategies
  if (context.entitiesCount > 10000) {
    strategies.push({
      id: 'entity-culling',
      name: 'Implement Entity Culling',
      category: 'cpu',
      severity: 'good',
      description: 'Skip updating entities that are not visible or relevant',
      impact: 'high',
      difficulty: 'moderate',
      estimatedImprovement: 25,
      prerequisites: ['frustum-culling'],
      enabled: true,
    })
  }
  
  return strategies.filter(s => s.enabled)
}

const calculateOverallPerformanceScore = (
  categoryScores: Readonly<Record<PerformanceCategory, number>>
): number => {
  const weights: Readonly<Record<PerformanceCategory, number>> = {
    fps: 0.3,
    memory: 0.2,
    latency: 0.15,
    cpu: 0.15,
    network: 0.1,
    gpu: 0.05,
    disk: 0.05,
  }
  
  let totalScore = 0
  let totalWeight = 0
  
  for (const [category, score] of Object.entries(categoryScores)) {
    const weight = weights[category as PerformanceCategory] || 0
    totalScore += score * weight
    totalWeight += weight
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 0
}

const identifyBottlenecks = (
  categoryScores: Readonly<Record<PerformanceCategory, number>>
): readonly PerformanceCategory[] => {
  const bottleneckThreshold = 50 // Score below which we consider it a bottleneck
  
  return Object.entries(categoryScores)
    .filter(([_, score]) => score < bottleneckThreshold)
    .map(([category, _]) => category as PerformanceCategory)
    .sort((a, b) => categoryScores[a] - categoryScores[b]) // Sort by severity
}

const generatePerformanceSummary = (analysis: PerformanceAnalysis): string => {
  const { overallScore, bottlenecks, alerts } = analysis
  
  if (overallScore >= 80) {
    return `Performance is excellent (${overallScore.toFixed(1)}/100). System is running smoothly with minimal issues.`
  } else if (overallScore >= 60) {
    return `Performance is good (${overallScore.toFixed(1)}/100). ${bottlenecks.length > 0 ? `Minor bottlenecks in: ${bottlenecks.join(', ')}.` : ''}`
  } else if (overallScore >= 40) {
    return `Performance needs attention (${overallScore.toFixed(1)}/100). Bottlenecks detected in: ${bottlenecks.join(', ')}. ${alerts.length} alerts active.`
  } else {
    return `Performance is poor (${overallScore.toFixed(1)}/100). Critical issues in: ${bottlenecks.join(', ')}. Immediate optimization recommended.`
  }
}

/**
 * Performance Domain Service Port
 */
export interface IPerformanceDomainService {
  readonly analyzePerformance: (
    metrics: readonly PerformanceMetric[],
    context: GamePerformanceContext,
    config: PerformanceConfig
  ) => Effect.Effect<PerformanceAnalysis, PerformanceAnalysisError, never>
  
  readonly createPerformanceMetric: (
    category: PerformanceCategory,
    value: number,
    timestamp?: number,
    metadata?: Readonly<Record<string, unknown>>
  ) => Effect.Effect<PerformanceMetric, never, never>
  
  readonly evaluateMetric: (
    metric: PerformanceMetric,
    config: PerformanceConfig
  ) => Effect.Effect<PerformanceAlert | null, never, never>
  
  readonly getOptimizationRecommendations: (
    context: GamePerformanceContext,
    analysis: PerformanceAnalysis
  ) => Effect.Effect<readonly OptimizationStrategy[], never, never>
  
  readonly validatePerformanceThresholds: (
    config: PerformanceConfig
  ) => Effect.Effect<boolean, PerformanceAnalysisError, never>
  
  readonly calculatePerformanceScore: (
    metrics: readonly PerformanceMetric[]
  ) => Effect.Effect<Readonly<Record<PerformanceCategory, number>>, never, never>
}

/**
 * Pure domain functions implementation
 */

const analyzePerformancePure = (
  metrics: readonly PerformanceMetric[],
  context: GamePerformanceContext,
  config: PerformanceConfig
): Effect.Effect<PerformanceAnalysis, PerformanceAnalysisError, never> =>
  Effect.gen(function* () {
    if (metrics.length === 0) {
      throw new PerformanceAnalysisError('No metrics provided for analysis')
    }
    
    // Calculate category scores
    const categoryScores: Record<PerformanceCategory, number> = {
      fps: 0,
      memory: 0,
      latency: 0,
      cpu: 0,
      network: 0,
      gpu: 0,
      disk: 0,
    }
    
    // Group metrics by category and calculate average scores
    const metricsByCategory = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = []
      }
      acc[metric.category].push(metric)
      return acc
    }, {} as Record<PerformanceCategory, PerformanceMetric[]>)
    
    for (const [category, categoryMetrics] of Object.entries(metricsByCategory)) {
      const avgValue = categoryMetrics.reduce((sum, m) => sum + m.value, 0) / categoryMetrics.length
      
      // Convert values to 0-100 scores based on thresholds
      switch (category as PerformanceCategory) {
        case 'fps':
          categoryScores.fps = Math.min(100, (avgValue / PERFORMANCE_THRESHOLDS.fps.excellent) * 100)
          break
        case 'memory':
          categoryScores.memory = Math.max(0, 100 - (avgValue / PERFORMANCE_THRESHOLDS.memory.critical) * 100)
          break
        case 'latency':
          categoryScores.latency = Math.max(0, 100 - (avgValue / PERFORMANCE_THRESHOLDS.latency.critical) * 100)
          break
        case 'cpu':
          categoryScores.cpu = Math.max(0, 100 - avgValue)
          break
        default:
          categoryScores[category as PerformanceCategory] = 50 // Neutral score for unknown categories
      }
    }
    
    const overallScore = calculateOverallPerformanceScore(categoryScores)
    const bottlenecks = identifyBottlenecks(categoryScores)
    
    // Generate alerts for recent metrics
    const recentMetrics = metrics.filter(m => Date.now() - m.timestamp < 60000) // Last minute
    const alerts: PerformanceAlert[] = []
    
    for (const metric of recentMetrics) {
      const threshold = getThresholdForCategory(metric.category, config)
      if (shouldCreateAlert(metric, threshold)) {
        const alert = yield* createPerformanceAlert(metric, threshold)
        alerts.push(alert)
      }
    }
    
    const recommendedOptimizations = getOptimizationStrategies(context, {
      overallScore,
      categoryScores,
      bottlenecks,
      recommendedOptimizations: [],
      alerts,
      summary: '',
    })
    
    const analysis: PerformanceAnalysis = {
      overallScore,
      categoryScores,
      bottlenecks,
      recommendedOptimizations,
      alerts,
      summary: generatePerformanceSummary({
        overallScore,
        categoryScores,
        bottlenecks,
        recommendedOptimizations,
        alerts,
        summary: '',
      }),
    }
    
    return analysis
  })

const getThresholdForCategory = (category: PerformanceCategory, config: PerformanceConfig): number => {
  switch (category) {
    case 'fps':
      return config.thresholds.fps.acceptable
    case 'memory':
      return config.thresholds.memory.high
    case 'latency':
      return config.thresholds.latency.acceptable
    case 'cpu':
      return config.thresholds.cpu.high
    default:
      return 0
  }
}

const shouldCreateAlert = (metric: PerformanceMetric, threshold: number): boolean => {
  switch (metric.category) {
    case 'fps':
      return metric.value < threshold
    case 'memory':
    case 'latency':
    case 'cpu':
      return metric.value > threshold
    default:
      return false
  }
}

const createPerformanceMetricPure = (
  category: PerformanceCategory,
  value: number,
  timestamp: number = Date.now(),
  metadata?: Readonly<Record<string, unknown>>
): Effect.Effect<PerformanceMetric, never, never> =>
  Effect.succeed(createPerformanceMetric(category, value, timestamp, metadata))

const evaluateMetricPure = (
  metric: PerformanceMetric,
  config: PerformanceConfig
): Effect.Effect<PerformanceAlert | null, never, never> =>
  Effect.gen(function* () {
    if (!config.monitoring.alertingEnabled) {
      return null
    }
    
    const threshold = getThresholdForCategory(metric.category, config)
    
    if (shouldCreateAlert(metric, threshold)) {
      return yield* createPerformanceAlert(metric, threshold)
    }
    
    return null
  })

const getOptimizationRecommendationsPure = (
  context: GamePerformanceContext,
  analysis: PerformanceAnalysis
): Effect.Effect<readonly OptimizationStrategy[], never, never> =>
  Effect.succeed(getOptimizationStrategies(context, analysis))

const validatePerformanceThresholdsPure = (
  config: PerformanceConfig
): Effect.Effect<boolean, PerformanceAnalysisError, never> =>
  Effect.gen(function* () {
    // Validate FPS thresholds
    if (config.thresholds.fps.critical >= config.thresholds.fps.poor ||
        config.thresholds.fps.poor >= config.thresholds.fps.acceptable ||
        config.thresholds.fps.acceptable >= config.thresholds.fps.good ||
        config.thresholds.fps.good >= config.thresholds.fps.excellent) {
      throw new PerformanceAnalysisError('FPS thresholds must be in ascending order')
    }
    
    // Validate memory thresholds
    if (config.thresholds.memory.low >= config.thresholds.memory.moderate ||
        config.thresholds.memory.moderate >= config.thresholds.memory.high ||
        config.thresholds.memory.high >= config.thresholds.memory.critical) {
      throw new PerformanceAnalysisError('Memory thresholds must be in ascending order')
    }
    
    return true
  })

const calculatePerformanceScorePure = (
  metrics: readonly PerformanceMetric[]
): Effect.Effect<Readonly<Record<PerformanceCategory, number>>, never, never> =>
  Effect.gen(function* () {
    const scores: Record<PerformanceCategory, number> = {
      fps: 0,
      memory: 0,
      latency: 0,
      cpu: 0,
      network: 0,
      gpu: 0,
      disk: 0,
    }
    
    const metricsByCategory = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = []
      }
      acc[metric.category].push(metric)
      return acc
    }, {} as Record<PerformanceCategory, PerformanceMetric[]>)
    
    for (const [category, categoryMetrics] of Object.entries(metricsByCategory)) {
      if (categoryMetrics.length > 0) {
        const avgSeverityScore = categoryMetrics.reduce((sum, m) => {
          const severityScores = { excellent: 100, good: 80, acceptable: 60, poor: 40, critical: 20 }
          return sum + severityScores[m.severity]
        }, 0) / categoryMetrics.length
        
        scores[category as PerformanceCategory] = avgSeverityScore
      }
    }
    
    return scores
  })

/**
 * Performance Domain Service Implementation
 */
const performanceDomainService: IPerformanceDomainService = {
  analyzePerformance: analyzePerformancePure,
  createPerformanceMetric: createPerformanceMetricPure,
  evaluateMetric: evaluateMetricPure,
  getOptimizationRecommendations: getOptimizationRecommendationsPure,
  validatePerformanceThresholds: validatePerformanceThresholdsPure,
  calculatePerformanceScore: calculatePerformanceScorePure,
}

/**
 * Context tag for dependency injection
 */
export const PerformanceDomainServicePort = Context.GenericTag<IPerformanceDomainService>('@domain/PerformanceDomainService')

/**
 * Live layer for Performance Domain Service
 */
export const PerformanceDomainServiceLive = Layer.succeed(
  PerformanceDomainServicePort,
  performanceDomainService
)

/**
 * Utility functions for performance domain operations
 */
export const PerformanceDomainUtils = {
  /**
   * Create default performance configuration
   */
  createDefaultPerformanceConfig: (): PerformanceConfig => ({
    monitoring: {
      enabled: true,
      sampleRate: 60,
      historyLength: 300,
      alertingEnabled: true,
      autoOptimizationEnabled: false,
    },
    thresholds: PERFORMANCE_THRESHOLDS,
    optimization: {
      aggressiveMemoryManagement: false,
      dynamicQualityAdjustment: true,
      adaptiveLOD: true,
      intelligentCulling: true,
    },
  }),

  /**
   * Create game performance context from current state
   */
  createGamePerformanceContext: (
    entitiesCount: number,
    chunksLoaded: number,
    chunksVisible: number,
    renderDistance: number = 16,
    qualityLevel: 'low' | 'medium' | 'high' | 'ultra' = 'medium',
    shaderComplexity: 'basic' | 'standard' | 'advanced' = 'standard',
    playerCount: number = 1,
    worldSize: number = 1000
  ): GamePerformanceContext => ({
    entitiesCount,
    chunksLoaded,
    chunksVisible,
    renderDistance,
    qualityLevel,
    shaderComplexity,
    playerCount,
    worldSize,
  }),

  /**
   * Convert severity to numeric score
   */
  severityToScore: (severity: PerformanceSeverity): number => {
    const scores = { excellent: 100, good: 80, acceptable: 60, poor: 40, critical: 20 }
    return scores[severity]
  },

  /**
   * Convert numeric score to severity
   */
  scoreToSeverity: (score: number): PerformanceSeverity => {
    if (score >= 90) return 'excellent'
    if (score >= 70) return 'good'
    if (score >= 50) return 'acceptable'
    if (score >= 30) return 'poor'
    return 'critical'
  },

  /**
   * Check if optimization strategy is applicable
   */
  isOptimizationApplicable: (
    strategy: OptimizationStrategy,
    context: GamePerformanceContext,
    currentScore: number
  ): boolean => {
    if (!strategy.enabled) return false
    
    // Check if the performance is poor enough to warrant this optimization
    const severityThresholds = { critical: 20, poor: 40, acceptable: 60, good: 80, excellent: 100 }
    if (currentScore > severityThresholds[strategy.severity]) return false
    
    // Check prerequisites
    return strategy.prerequisites.length === 0 // Simplified - would check if prerequisites are met
  },
} as const

/**
 * Export types and constants
 */
export type {
  PerformanceMetric,
  PerformanceAlert,
  OptimizationStrategy,
  PerformanceAnalysis,
  GamePerformanceContext,
  PerformanceConfig,
  PerformanceCategory,
  PerformanceSeverity,
  AlertType,
  IPerformanceDomainService,
}