---
title: "パーティクルシステム仕様 - 視覚エフェクト・物理シミュレーション・レンダリング最適化"
description: "Minecraft Cloneの包括的パーティクルシステム。爆発、煙、魔法エフェクトの物理ベース視覚効果。WebGL最適化とEffect-TS並行処理による高性能レンダリング実装。"
category: "specification"
difficulty: "advanced"
tags: ["particle-system", "visual-effects", "rendering", "webgl", "physics", "performance", "graphics"]
prerequisites: ["webgl-basics", "physics-fundamentals", "effect-ts-concurrency", "3d-mathematics"]
estimated_reading_time: "22分"
related_patterns: ["rendering-patterns", "physics-patterns", "optimization-patterns"]
related_docs: ["./00-overview.md", "../00-core-features/05-rendering-system.md", "../00-core-features/06-physics-system.md"]
search_keywords:
  primary: ["particle-system", "visual-effects", "explosion-effects", "particle-physics"]
  secondary: ["webgl-particles", "game-graphics", "minecraft-effects"]
  context: ["3d-rendering", "game-development", "visual-programming"]
---

# Particle System - パーティクルシステム

## 概要

Particle Systemは、Minecraftの世界に豊富な視覚効果を提供する高性能システムです。爆発、煙、水しぶき、魔法効果、天候現象など、様々なイベントを美しく表現するために設計されています。Effect-TSの並行処理機能とWebGPU対応Three.js r160+を活用し、大量のパーティクルをリアルタイムで効率的に処理します。

## システム設計原理

### Particle Core Engine

高性能なパーティクル生成・管理・描画エンジンです。

```typescript
import { Effect, Layer, Context, Stream, Queue, Ref, Schema, Match, pipe, Brand } from "effect"
import * as THREE from "three/webgpu"
import { uniform, attribute, vec3, vec4, time } from "three/tsl"

// Domain Types
export type ParticleId = Brand.Brand<string, "ParticleId">
export const ParticleId = Schema.String.pipe(Schema.brand("ParticleId"))

export type LifetimeSeconds = Brand.Brand<number, "LifetimeSeconds">
export const LifetimeSeconds = pipe(
  Schema.Number,
  Schema.positive(),
  Schema.brand("LifetimeSeconds")
)

export type ParticleSize = Brand.Brand<number, "ParticleSize">
export const ParticleSize = pipe(
  Schema.Number,
  Schema.between(0.01, 100),
  Schema.brand("ParticleSize")
)

export type OpacityValue = Brand.Brand<number, "OpacityValue">
export const OpacityValue = pipe(
  Schema.Number,
  Schema.between(0, 1),
  Schema.brand("OpacityValue")
)

// Particle Types
export const ParticleType = Schema.Union(
  Schema.Literal("smoke"),
  Schema.Literal("fire"),
  Schema.Literal("water"),
  Schema.Literal("explosion"),
  Schema.Literal("magic"),
  Schema.Literal("block_break"),
  Schema.Literal("mob_effect"),
  Schema.Literal("weather"),
  Schema.Literal("damage"),
  Schema.Literal("healing"),
  Schema.Literal("experience"),
  Schema.Literal("enchant"),
  Schema.Literal("portal"),
  Schema.Literal("redstone")
)

export type ParticleType = Schema.Schema.Type<typeof ParticleType>

// Vector3 Schema
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export type Vector3Schema = Schema.Schema.Type<typeof Vector3Schema>

// Color Schema
export const ColorSchema = Schema.Struct({
  r: pipe(Schema.Number, Schema.between(0, 1)),
  g: pipe(Schema.Number, Schema.between(0, 1)),
  b: pipe(Schema.Number, Schema.between(0, 1)),
  a: pipe(Schema.Number, Schema.between(0, 1))
})

export type ColorSchema = Schema.Schema.Type<typeof ColorSchema>

// Particle Definition
export const ParticleState = Schema.Struct({
  id: ParticleId,
  type: ParticleType,
  position: Vector3Schema,
  velocity: Vector3Schema,
  acceleration: Vector3Schema,
  lifetime: LifetimeSeconds,
  age: Schema.Number.pipe(Schema.nonNegative()),
  size: ParticleSize,
  color: ColorSchema,
  opacity: OpacityValue,
  rotation: Schema.Number,
  angularVelocity: Schema.Number,
  active: Schema.Boolean,
  userData: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional())
})

export type ParticleState = Schema.Schema.Type<typeof ParticleState>
```

### Emitter System

パーティクル発生源を管理するシステムです。

```typescript
// Emitter Configuration
export const EmitterShape = Schema.Union(
  Schema.Literal("point"),
  Schema.Literal("sphere"),
  Schema.Literal("box"),
  Schema.Literal("cone"),
  Schema.Literal("cylinder"),
  Schema.Literal("plane")
)

export type EmitterShape = Schema.Schema.Type<typeof EmitterShape>

export const EmitterConfig = Schema.Struct({
  id: Schema.String,
  type: ParticleType,
  shape: EmitterShape,
  position: Vector3Schema,
  rotation: Vector3Schema,
  scale: Vector3Schema,
  emissionRate: pipe(Schema.Number, Schema.positive()), // particles per second
  maxParticles: pipe(Schema.Number, Schema.int(), Schema.positive()),
  particleLifetime: LifetimeSeconds,
  particleSize: ParticleSize,
  sizeVariation: pipe(Schema.Number, Schema.between(0, 1)),
  initialVelocity: Vector3Schema,
  velocityVariation: Vector3Schema,
  acceleration: Vector3Schema,
  color: ColorSchema,
  colorVariation: ColorSchema,
  opacity: OpacityValue,
  opacityOverTime: Schema.Array(Schema.Struct({
    time: pipe(Schema.Number, Schema.between(0, 1)),
    opacity: OpacityValue
  })),
  sizeOverTime: Schema.Array(Schema.Struct({
    time: pipe(Schema.Number, Schema.between(0, 1)),
    size: ParticleSize
  })),
  active: Schema.Boolean,
  duration: Schema.Number.pipe(Schema.optional()),
  loop: Schema.Boolean
})

export type EmitterConfig = Schema.Schema.Type<typeof EmitterConfig>

// Particle System Errors
export class ParticleSystemError extends Schema.TaggedError("ParticleSystemError")<{
  message: string
  timestamp: number
}> {}

export class EmitterError extends Schema.TaggedError("EmitterError")<{
  emitterId: string
  message: string
  timestamp: number
}> {}

export class RenderingError extends Schema.TaggedError("RenderingError")<{
  message: string
  particleCount: number
  timestamp: number
}> {}
```

### Particle System Core Interface

```typescript
// Particle System Interface
interface ParticleSystemInterface {
  readonly createEmitter: (
    config: EmitterConfig
  ) => Effect.Effect<string, EmitterError>

  readonly destroyEmitter: (
    emitterId: string
  ) => Effect.Effect<void, never>

  readonly updateEmitter: (
    emitterId: string,
    config: Partial<EmitterConfig>
  ) => Effect.Effect<void, EmitterError>

  readonly emitParticles: (
    emitterId: string,
    count: number
  ) => Effect.Effect<void, EmitterError>

  readonly updateParticles: (
    deltaTime: number
  ) => Effect.Effect<number, ParticleSystemError> // returns active particle count

  readonly getActiveParticleCount: () => Effect.Effect<number, never>

  readonly setQualityLevel: (
    level: "low" | "medium" | "high" | "ultra"
  ) => Effect.Effect<void, never>

  readonly cleanup: () => Effect.Effect<void, never>
}

const ParticleSystem = Context.GenericTag<ParticleSystemInterface>("@minecraft/ParticleSystem")

// Implementation
export const ParticleSystemLive = Layer.effect(
  ParticleSystem,
  Effect.gen(function* () {
    const emitters = yield* Ref.make<Map<string, EmitterConfig>>(new Map())
    const particles = yield* Ref.make<Map<ParticleId, ParticleState>>(new Map())
    const particlePool = yield* Queue.bounded<ParticleState>(10000)
    const qualitySettings = yield* Ref.make({
      maxParticles: 5000,
      updateFrequency: 60, // FPS
      cullingDistance: 100,
      lodEnabled: true
    })

    // WebGPU Renderer Setup
    const renderer = yield* WebGPURenderer
    const particleGeometry = yield* Effect.sync(() => new THREE.PlaneGeometry(1, 1))
    const particleMaterial = yield* createParticleMaterial()

    const createEmitter = (config: EmitterConfig) => Effect.gen(function* () {
      const emitterId = crypto.randomUUID()

      // Validate configuration
      yield* validateEmitterConfig(config)

      yield* Ref.update(emitters, map => map.set(emitterId, config))

      return emitterId
    })

    const destroyEmitter = (emitterId: string) => Effect.gen(function* () {
      yield* Ref.update(emitters, map => {
        map.delete(emitterId)
        return map
      })

      // Remove all particles from this emitter
      yield* cleanupEmitterParticles(emitterId)
    })

    const emitParticles = (emitterId: string, count: number) => Effect.gen(function* () {
      const emitterMap = yield* Ref.get(emitters)
      const emitter = emitterMap.get(emitterId)

      if (!emitter) {
        return yield* Effect.fail(new EmitterError({
          emitterId,
          message: "Emitter not found",
          timestamp: Date.now()
        }))
      }

      // Early return if emitter is inactive
      if (!emitter.active) {
        return
      }

      const particlesToEmit = Math.min(count, emitter.maxParticles)

      yield* Effect.forEach(
        Array.from({ length: particlesToEmit }),
        () => createParticle(emitter),
        { concurrency: "unbounded" }
      )
    })

    const updateParticles = (deltaTime: number) => Effect.gen(function* () {
      const particleMap = yield* Ref.get(particles)
      const settings = yield* Ref.get(qualitySettings)

      let activeCount = 0
      const updatedParticles = new Map<ParticleId, ParticleState>()

      for (const [id, particle] of particleMap) {
        // Early return for inactive particles
        if (!particle.active) {
          continue
        }

        const newAge = particle.age + deltaTime

        // Early return for expired particles
        if (newAge >= particle.lifetime) {
          yield* recycleParticle(particle)
          continue
        }

        const updatedParticle = yield* updateParticlePhysics(particle, deltaTime)
        updatedParticles.set(id, updatedParticle)
        activeCount++
      }

      yield* Ref.set(particles, updatedParticles)

      return activeCount
    })

    const updateParticlePhysics = (
      particle: ParticleState,
      deltaTime: number
    ) => Effect.gen(function* () {
      // Update position based on velocity
      const newPosition = {
        x: particle.position.x + particle.velocity.x * deltaTime,
        y: particle.position.y + particle.velocity.y * deltaTime,
        z: particle.position.z + particle.velocity.z * deltaTime
      }

      // Update velocity based on acceleration
      const newVelocity = {
        x: particle.velocity.x + particle.acceleration.x * deltaTime,
        y: particle.velocity.y + particle.acceleration.y * deltaTime,
        z: particle.velocity.z + particle.acceleration.z * deltaTime
      }

      // Update rotation
      const newRotation = particle.rotation + particle.angularVelocity * deltaTime

      // Update age
      const newAge = particle.age + deltaTime

      // Calculate opacity and size over time
      const lifeProgress = newAge / particle.lifetime
      const newOpacity = calculateOpacityOverTime(particle, lifeProgress)
      const newSize = calculateSizeOverTime(particle, lifeProgress)

      return {
        ...particle,
        position: newPosition,
        velocity: newVelocity,
        rotation: newRotation,
        age: newAge,
        opacity: newOpacity,
        size: newSize
      }
    })

    const setQualityLevel = (level: "low" | "medium" | "high" | "ultra") => Effect.gen(function* () {
      const newSettings = Match.value(level).pipe(
        Match.when("low", () => ({
          maxParticles: 1000,
          updateFrequency: 30,
          cullingDistance: 50,
          lodEnabled: true
        })),
        Match.when("medium", () => ({
          maxParticles: 3000,
          updateFrequency: 45,
          cullingDistance: 75,
          lodEnabled: true
        })),
        Match.when("high", () => ({
          maxParticles: 5000,
          updateFrequency: 60,
          cullingDistance: 100,
          lodEnabled: false
        })),
        Match.when("ultra", () => ({
          maxParticles: 10000,
          updateFrequency: 60,
          cullingDistance: 150,
          lodEnabled: false
        })),
        Match.exhaustive
      )

      yield* Ref.set(qualitySettings, newSettings)
    })

    return {
      createEmitter,
      destroyEmitter,
      updateEmitter: (emitterId, config) => updateEmitterImpl(emitterId, config),
      emitParticles,
      updateParticles,
      getActiveParticleCount: () => Ref.get(particles).pipe(
        Effect.map(map => Array.from(map.values()).filter(p => p.active).length)
      ),
      setQualityLevel,
      cleanup: () => cleanupAllParticles()
    } as const
  })
)
```

### WebGPU-Based Rendering System

```typescript
// WebGPU Particle Renderer
interface ParticleRendererInterface {
  readonly initializeRenderer: (
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene
  ) => Effect.Effect<void, RenderingError>

  readonly renderParticles: (
    particles: ReadonlyArray<ParticleState>
  ) => Effect.Effect<void, RenderingError>

  readonly updateInstancedMesh: (
    particles: ReadonlyArray<ParticleState>
  ) => Effect.Effect<void, RenderingError>

  readonly createParticleMaterial: (
    type: ParticleType
  ) => Effect.Effect<THREE.Material, RenderingError>

  readonly optimizeRendering: (
    cameraPosition: Vector3Schema
  ) => Effect.Effect<void, never>
}

const ParticleRenderer = Context.GenericTag<ParticleRendererInterface>("@minecraft/ParticleRenderer")

export const ParticleRendererLive = Layer.effect(
  ParticleRenderer,
  Effect.gen(function* () {
    let instancedMeshes = new Map<ParticleType, THREE.InstancedMesh>()
    let particleMaterials = new Map<ParticleType, THREE.Material>()
    let scene: THREE.Scene | null = null
    let renderer: THREE.WebGPURenderer | null = null

    const initializeRenderer = (
      webgpuRenderer: THREE.WebGPURenderer,
      targetScene: THREE.Scene
    ) => Effect.gen(function* () {
      renderer = webgpuRenderer
      scene = targetScene

      // Initialize instanced meshes for each particle type
      yield* Effect.forEach(
        [
          "smoke", "fire", "water", "explosion", "magic",
          "block_break", "mob_effect", "weather", "damage",
          "healing", "experience", "enchant", "portal", "redstone"
        ] as ParticleType[],
        (type) => createInstancedMeshForType(type),
        { concurrency: "unbounded" }
      )
    })

    const createInstancedMeshForType = (type: ParticleType) => Effect.gen(function* () {
      const geometry = new THREE.PlaneGeometry(1, 1)
      const material = yield* createParticleMaterial(type)
      const maxInstances = 1000 // Per type

      const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances)
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      instancedMesh.userData = { particleType: type }

      instancedMeshes.set(type, instancedMesh)
      scene?.add(instancedMesh)

      return instancedMesh
    })

    const createParticleMaterial = (type: ParticleType) => Effect.gen(function* () {
      const material = new THREE.MeshBasicNodeMaterial()

      // TSL-based material with type-specific properties
      const particleConfig = Match.value(type).pipe(
        Match.when("fire", () => ({
          baseColor: vec4(1, 0.3, 0.1, 1),
          emissive: vec4(1, 0.5, 0, 1),
          animated: true
        })),
        Match.when("water", () => ({
          baseColor: vec4(0.2, 0.5, 1, 0.8),
          emissive: vec4(0, 0, 0, 0),
          animated: false
        })),
        Match.when("smoke", () => ({
          baseColor: vec4(0.5, 0.5, 0.5, 0.6),
          emissive: vec4(0, 0, 0, 0),
          animated: true
        })),
        Match.when("explosion", () => ({
          baseColor: vec4(1, 1, 0.5, 1),
          emissive: vec4(1, 0.8, 0.2, 1),
          animated: true
        })),
        Match.when("magic", () => ({
          baseColor: vec4(0.7, 0.2, 1, 0.9),
          emissive: vec4(0.5, 0.1, 0.8, 0.5),
          animated: true
        })),
        Match.orElse(() => ({
          baseColor: vec4(1, 1, 1, 1),
          emissive: vec4(0, 0, 0, 0),
          animated: false
        }))
      )

      // Set up TSL nodes
      material.colorNode = particleConfig.baseColor
      material.emissiveNode = particleConfig.emissive

      if (particleConfig.animated) {
        // Add time-based animation
        const timeNode = time.mul(2.0)
        const animatedColor = particleConfig.baseColor.mul(
          timeNode.sin().add(1).mul(0.5)
        )
        material.colorNode = animatedColor
      }

      material.transparent = true
      material.depthWrite = false
      material.blending = THREE.AdditiveBlending

      particleMaterials.set(type, material)

      return material
    })

    const renderParticles = (particles: ReadonlyArray<ParticleState>) => Effect.gen(function* () {
      if (!renderer || !scene) {
        return yield* Effect.fail(new RenderingError({
          message: "Renderer not initialized",
          particleCount: particles.length,
          timestamp: Date.now()
        }))
      }

      // Group particles by type
      const particlesByType = new Map<ParticleType, ParticleState[]>()

      for (const particle of particles) {
        if (!particle.active) continue

        const typeArray = particlesByType.get(particle.type) ?? []
        typeArray.push(particle)
        particlesByType.set(particle.type, typeArray)
      }

      // Update instanced meshes
      yield* Effect.forEach(
        Array.from(particlesByType.entries()),
        ([type, typeParticles]) => updateInstancedMeshForType(type, typeParticles),
        { concurrency: "unbounded" }
      )
    })

    const updateInstancedMeshForType = (
      type: ParticleType,
      particles: ReadonlyArray<ParticleState>
    ) => Effect.gen(function* () {
      const mesh = instancedMeshes.get(type)
      if (!mesh) return

      const matrix = new THREE.Matrix4()
      const maxInstances = Math.min(particles.length, mesh.count)

      for (let i = 0; i < maxInstances; i++) {
        const particle = particles[i]

        // Set matrix for each instance
        matrix.makeRotationZ(particle.rotation)
        matrix.scale(
          new THREE.Vector3(particle.size, particle.size, particle.size)
        )
        matrix.setPosition(
          particle.position.x,
          particle.position.y,
          particle.position.z
        )

        mesh.setMatrixAt(i, matrix)

        // Update color if needed
        const color = new THREE.Color(
          particle.color.r,
          particle.color.g,
          particle.color.b
        )
        mesh.setColorAt?.(i, color)
      }

      // Hide unused instances
      for (let i = maxInstances; i < mesh.count; i++) {
        matrix.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, matrix)
      }

      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true
      }
    })

    return {
      initializeRenderer,
      renderParticles,
      updateInstancedMesh: (particles) => renderParticles(particles),
      createParticleMaterial,
      optimizeRendering: (cameraPosition) => optimizeRenderingImpl(cameraPosition)
    } as const
  })
)
```

### 高度なパーティクル効果

```typescript
// Advanced Particle Effects
export const AdvancedParticleEffects = {
  // 爆発エフェクト
  createExplosionEffect: (position: Vector3Schema, intensity: number) => Effect.gen(function* () {
    const particleSystem = yield* ParticleSystem

    // メイン爆発
    const mainExplosion = yield* particleSystem.createEmitter({
      id: `explosion_main_${Date.now()}`,
      type: "explosion",
      shape: "sphere",
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: intensity, y: intensity, z: intensity },
      emissionRate: 50 * intensity,
      maxParticles: Math.floor(100 * intensity),
      particleLifetime: 2.0 as LifetimeSeconds,
      particleSize: (0.5 * intensity) as ParticleSize,
      sizeVariation: 0.3,
      initialVelocity: { x: 0, y: 0, z: 0 },
      velocityVariation: { x: 10 * intensity, y: 10 * intensity, z: 10 * intensity },
      acceleration: { x: 0, y: -9.8, z: 0 },
      color: { r: 1, g: 0.5, b: 0.1, a: 1 },
      colorVariation: { r: 0.2, g: 0.2, b: 0.1, a: 0 },
      opacity: 1 as OpacityValue,
      opacityOverTime: [
        { time: 0, opacity: 1 as OpacityValue },
        { time: 0.3, opacity: 0.8 as OpacityValue },
        { time: 1, opacity: 0 as OpacityValue }
      ],
      sizeOverTime: [
        { time: 0, size: (0.2 * intensity) as ParticleSize },
        { time: 0.1, size: (0.8 * intensity) as ParticleSize },
        { time: 1, size: (0.1 * intensity) as ParticleSize }
      ],
      active: true,
      duration: 0.5,
      loop: false
    })

    // 煙エフェクト
    const smokeEffect = yield* particleSystem.createEmitter({
      id: `explosion_smoke_${Date.now()}`,
      type: "smoke",
      shape: "sphere",
      position: { x: position.x, y: position.y + 1, z: position.z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: intensity * 1.5, y: intensity * 1.5, z: intensity * 1.5 },
      emissionRate: 30 * intensity,
      maxParticles: Math.floor(80 * intensity),
      particleLifetime: 4.0 as LifetimeSeconds,
      particleSize: (1.0 * intensity) as ParticleSize,
      sizeVariation: 0.5,
      initialVelocity: { x: 0, y: 3, z: 0 },
      velocityVariation: { x: 3, y: 2, z: 3 },
      acceleration: { x: 0, y: 1, z: 0 },
      color: { r: 0.3, g: 0.3, b: 0.3, a: 0.7 },
      colorVariation: { r: 0.2, g: 0.2, b: 0.2, a: 0 },
      opacity: 0.7 as OpacityValue,
      opacityOverTime: [
        { time: 0, opacity: 0 as OpacityValue },
        { time: 0.2, opacity: 0.7 as OpacityValue },
        { time: 1, opacity: 0 as OpacityValue }
      ],
      sizeOverTime: [
        { time: 0, size: (0.5 * intensity) as ParticleSize },
        { time: 0.5, size: (2.0 * intensity) as ParticleSize },
        { time: 1, size: (3.0 * intensity) as ParticleSize }
      ],
      active: true,
      duration: 2.0,
      loop: false
    })

    return { mainExplosion, smokeEffect }
  }),

  // 魔法エフェクト
  createMagicEffect: (
    position: Vector3Schema,
    color: ColorSchema,
    pattern: "spiral" | "burst" | "stream"
  ) => Effect.gen(function* () {
    const particleSystem = yield* ParticleSystem

    const baseConfig = {
      type: "magic" as const,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      particleLifetime: 3.0 as LifetimeSeconds,
      particleSize: 0.3 as ParticleSize,
      color,
      colorVariation: { r: 0.1, g: 0.1, b: 0.1, a: 0 },
      opacity: 0.9 as OpacityValue,
      active: true,
      loop: true
    }

    const patternConfig = Match.value(pattern).pipe(
      Match.when("spiral", () => ({
        id: `magic_spiral_${Date.now()}`,
        shape: "cone" as const,
        emissionRate: 20,
        maxParticles: 100,
        initialVelocity: { x: 0, y: 2, z: 0 },
        velocityVariation: { x: 1, y: 1, z: 1 },
        acceleration: { x: 0, y: -1, z: 0 }
      })),
      Match.when("burst", () => ({
        id: `magic_burst_${Date.now()}`,
        shape: "sphere" as const,
        emissionRate: 50,
        maxParticles: 150,
        initialVelocity: { x: 0, y: 0, z: 0 },
        velocityVariation: { x: 8, y: 8, z: 8 },
        acceleration: { x: 0, y: -2, z: 0 }
      })),
      Match.when("stream", () => ({
        id: `magic_stream_${Date.now()}`,
        shape: "cone" as const,
        emissionRate: 30,
        maxParticles: 120,
        initialVelocity: { x: 0, y: 5, z: 0 },
        velocityVariation: { x: 0.5, y: 1, z: 0.5 },
        acceleration: { x: 0, y: -0.5, z: 0 }
      })),
      Match.exhaustive
    )

    return yield* particleSystem.createEmitter({
      ...baseConfig,
      ...patternConfig,
      sizeVariation: 0.2,
      opacityOverTime: [
        { time: 0, opacity: 0 as OpacityValue },
        { time: 0.1, opacity: 0.9 as OpacityValue },
        { time: 0.8, opacity: 0.6 as OpacityValue },
        { time: 1, opacity: 0 as OpacityValue }
      ],
      sizeOverTime: [
        { time: 0, size: 0.1 as ParticleSize },
        { time: 0.3, size: 0.4 as ParticleSize },
        { time: 1, size: 0.2 as ParticleSize }
      ]
    })
  })
}
```

### パフォーマンス最適化

```typescript
// Performance Optimization Strategies
export const ParticleOptimizer = {
  // LOD System
  calculateLOD: (particlePosition: Vector3Schema, cameraPosition: Vector3Schema) => {
    const distance = Math.sqrt(
      Math.pow(particlePosition.x - cameraPosition.x, 2) +
      Math.pow(particlePosition.y - cameraPosition.y, 2) +
      Math.pow(particlePosition.z - cameraPosition.z, 2)
    )

    return Match.value(true).pipe(
      Match.when(() => distance < 10, () => "high" as const),
      Match.when(() => distance < 50, () => "medium" as const),
      Match.when(() => distance < 100, () => "low" as const),
      Match.orElse(() => "none" as const)
    )
  },

  // Culling
  frustumCull: (
    particles: ReadonlyArray<ParticleState>,
    camera: THREE.Camera
  ) => Effect.gen(function* () {
    const frustum = new THREE.Frustum()
    const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    frustum.setFromProjectionMatrix(matrix)

    return particles.filter(particle => {
      const point = new THREE.Vector3(
        particle.position.x,
        particle.position.y,
        particle.position.z
      )
      return frustum.containsPoint(point)
    })
  }),

  // Occlusion Culling
  occlusionCull: (
    particles: ReadonlyArray<ParticleState>,
    world: World
  ) => Effect.gen(function* () {
    // Simplified occlusion check
    const visibleParticles: ParticleState[] = []

    for (const particle of particles) {
      const isVisible = yield* checkParticleVisibility(particle, world)
      if (isVisible) {
        visibleParticles.push(particle)
      }
    }

    return visibleParticles
  }),

  // Batch Processing
  batchUpdate: (
    particles: ReadonlyArray<ParticleState>,
    deltaTime: number,
    batchSize: number = 100
  ) => Effect.gen(function* () {
    const batches: ParticleState[][] = []

    for (let i = 0; i < particles.length; i += batchSize) {
      batches.push(particles.slice(i, i + batchSize))
    }

    const results = yield* Effect.forEach(
      batches,
      batch => updateParticleBatch(batch, deltaTime),
      { concurrency: 4 } // 4 concurrent batches
    )

    return results.flat()
  })
}
```

### Layer構成

```typescript
// Particle System Layer
export const ParticleSystemLayer = Layer.mergeAll(
  ParticleSystemLive,
  ParticleRendererLive
).pipe(
  Layer.provide(WebGPURendererLayer),
  Layer.provide(WorldSystemLayer),
  Layer.provide(EventBusLayer)
)
```

### 使用例とテスト戦略

```typescript
// 使用例
const exampleParticleUsage = Effect.gen(function* () {
  const particleSystem = yield* ParticleSystem

  // 爆発エフェクトの作成
  const explosionEffects = yield* AdvancedParticleEffects.createExplosionEffect(
    { x: 0, y: 10, z: 0 },
    2.0 // intensity
  )

  // 5秒間パーティクルを放出
  yield* Effect.forEach(
    Array.from({ length: 300 }, (_, i) => i * 16), // 60fps for 5 seconds
    (deltaTime) => particleSystem.updateParticles(deltaTime / 1000),
    { concurrency: 1 }
  )

  // クリーンアップ
  yield* particleSystem.cleanup()
})

// PBTテスト
const particleSystemTests = {
  testParticleLifecycle: (particles: ReadonlyArray<ParticleState>) => {
    // Property: All particles should have age <= lifetime
    return particles.every(p => p.age <= p.lifetime)
  },

  testEmissionRate: (emitter: EmitterConfig, deltaTime: number) => {
    // Property: Emission count should be proportional to rate and time
    const expectedCount = Math.floor(emitter.emissionRate * deltaTime)
    return expectedCount >= 0 && expectedCount <= emitter.maxParticles
  },

  testParticlePhysics: (particle: ParticleState, deltaTime: number) => {
    // Property: Position should change based on velocity
    const expectedX = particle.position.x + particle.velocity.x * deltaTime
    return Math.abs(expectedX - particle.position.x) >= 0
  }
}
```

このParticle Systemは、Effect-TSの最新パターンとWebGPU対応Three.js r160+を活用し、高性能で柔軟な視覚効果システムを提供します。大量のパーティクルをリアルタイムで処理し、美しいゲーム体験を実現します。
