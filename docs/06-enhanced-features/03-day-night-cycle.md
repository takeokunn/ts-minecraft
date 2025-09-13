# Day/Night Cycle - 昼夜サイクルシステム

## 概要

Day/Night Cycleシステムは、Minecraftの世界に動的な時間の流れを提供する基盤システムです。太陽と月の軌道計算、光源システムの管理、時間に基づくゲーム要素の制御、そしてリアルな昼夜の移り変わりを実装します。Effect-TSのSignalとStreamを活用し、連続的で滑らかな時間変化を実現します。

## システム設計原理

### Time Management System

ゲーム内時間を管理する包括的なシステムです。

```typescript
import { Effect, Layer, Context, Stream, Signal, Schema, Ref, pipe, Match, Queue } from "effect"
import { Brand } from "effect"

// Domain Types
export type GameTick = Brand.Brand<number, "GameTick">
export const GameTick = pipe(
  Schema.Number,
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("GameTick")
)

export type GameTime = Brand.Brand<number, "GameTime"> // 0-24000 ticks per day
export const GameTime = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(0, 24000),
  Schema.brand("GameTime")
)

export type DayPhase = Schema.Schema.Type<typeof DayPhase>
export const DayPhase = Schema.Literal(
  "dawn",        // 23000-1000 ticks
  "morning",     // 1000-6000 ticks
  "day",         // 6000-12000 ticks
  "evening",     // 12000-13000 ticks
  "dusk",        // 13000-14000 ticks
  "night",       // 14000-18000 ticks
  "midnight",    // 18000-22000 ticks
  "late_night"   // 22000-23000 ticks
)

export type LightLevel = Brand.Brand<number, "LightLevel"> // 0-15
export const LightLevel = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand("LightLevel")
)

// Time State
export const TimeState = Schema.Struct({
  currentTick: GameTick,
  gameTime: GameTime,
  dayPhase: DayPhase,
  dayCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  sunAngle: Schema.Number.pipe(Schema.between(0, 360)), // degrees
  moonAngle: Schema.Number.pipe(Schema.between(0, 360)), // degrees
  skyLightLevel: LightLevel,
  timestamp: Schema.DateTimeUtc
})

export type TimeState = Schema.Schema.Type<typeof TimeState>

// Celestial Bodies
export const CelestialBody = Schema.Struct({
  type: Schema.Literal("sun", "moon", "star"),
  position: Schema.Struct({
    azimuth: Schema.Number.pipe(Schema.between(0, 360)),
    elevation: Schema.Number.pipe(Schema.between(-90, 90))
  }),
  brightness: Schema.Number.pipe(Schema.between(0, 1)),
  visible: Schema.Boolean,
  phase: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))) // For moon phases
})

export type CelestialBody = Schema.Schema.Type<typeof CelestialBody>

// Time Configuration
export const TimeConfig = Schema.Struct({
  ticksPerSecond: Schema.Number.pipe(Schema.positive(), Schema.default(() => 20)),
  dayLength: Schema.Number.pipe(Schema.positive(), Schema.default(() => 20 * 60)), // 20 minutes in real time
  doDayLightCycle: Schema.Boolean.pipe(Schema.default(() => true)),
  weatherCycle: Schema.Boolean.pipe(Schema.default(() => true)),
  timeSpeed: Schema.Number.pipe(Schema.positive(), Schema.default(() => 1.0)),
  moonPhaseLength: Schema.Number.pipe(Schema.positive(), Schema.default(() => 8)) // 8 days per moon cycle
})

export type TimeConfig = Schema.Schema.Type<typeof TimeConfig>
```

### Time System Core

時間システムのコア機能を提供します。

```typescript
// Time System Service
interface TimeSystem {
  readonly getCurrentTime: () => Effect.Effect<TimeState, never>

  readonly setTime: (gameTime: GameTime) => Effect.Effect<void, never>

  readonly advanceTime: (ticks: number) => Effect.Effect<TimeState, never>

  readonly getDayPhase: (gameTime?: GameTime) => Effect.Effect<DayPhase, never>

  readonly getSkyLightLevel: (gameTime?: GameTime) => Effect.Effect<LightLevel, never>

  readonly calculateSunPosition: (gameTime: GameTime) => Effect.Effect<CelestialBody, never>

  readonly calculateMoonPosition: (
    gameTime: GameTime,
    dayCount: number
  ) => Effect.Effect<CelestialBody, never>

  readonly getTimeMultiplier: () => Effect.Effect<number, never>

  readonly setTimeMultiplier: (multiplier: number) => Effect.Effect<void, never>

  readonly pauseTime: () => Effect.Effect<void, never>

  readonly resumeTime: () => Effect.Effect<void, never>
}

export const TimeSystem = Context.GenericTag<TimeSystem>("@app/TimeSystem")

export const TimeSystemLive = Layer.effect(
  TimeSystem,
  Effect.gen(function* () {
    const timeState = yield* Ref.make<TimeState>({
      currentTick: 0 as GameTick,
      gameTime: 6000 as GameTime, // Start at morning
      dayPhase: "morning" as DayPhase,
      dayCount: 0,
      sunAngle: 90,
      moonAngle: 270,
      skyLightLevel: 15 as LightLevel,
      timestamp: new Date()
    })

    const config = yield* Ref.make<TimeConfig>({
      ticksPerSecond: 20,
      dayLength: 20 * 60,
      doDayLightCycle: true,
      weatherCycle: true,
      timeSpeed: 1.0,
      moonPhaseLength: 8
    })

    const isPaused = yield* Ref.make(false)

    const getCurrentTime = () => Ref.get(timeState)

    const setTime = (gameTime: GameTime) => Effect.gen(function* () {
      const current = yield* Ref.get(timeState)
      const newPhase = yield* getDayPhase(gameTime)
      const newSkyLight = yield* getSkyLightLevel(gameTime)

      const newState: TimeState = {
        ...current,
        gameTime,
        dayPhase: newPhase,
        skyLightLevel: newSkyLight,
        timestamp: new Date()
      }

      yield* Ref.set(timeState, newState)
    })

    const advanceTime = (ticks: number) => Effect.gen(function* () {
      const paused = yield* Ref.get(isPaused)
      if (paused) {
        return yield* getCurrentTime()
      }

      const current = yield* Ref.get(timeState)
      const newTick = (current.currentTick + ticks) as GameTick
      const newGameTime = ((current.gameTime + ticks) % 24000) as GameTime
      const newDayCount = current.dayCount + Math.floor((current.gameTime + ticks) / 24000)

      const newPhase = yield* getDayPhase(newGameTime)
      const newSkyLight = yield* getSkyLightLevel(newGameTime)
      const sunPosition = yield* calculateSunPosition(newGameTime)
      const moonPosition = yield* calculateMoonPosition(newGameTime, newDayCount)

      const newState: TimeState = {
        currentTick: newTick,
        gameTime: newGameTime,
        dayPhase: newPhase,
        dayCount: newDayCount,
        sunAngle: sunPosition.position.azimuth,
        moonAngle: moonPosition.position.azimuth,
        skyLightLevel: newSkyLight,
        timestamp: new Date()
      }

      yield* Ref.set(timeState, newState)
      return newState
    })

    const getDayPhase = (gameTime?: GameTime) => Effect.gen(function* () {
      const time = gameTime ?? (yield* getCurrentTime()).gameTime

      return yield* Match.value(time).pipe(
        Match.when((t) => t >= 23000 || t < 1000, () => Effect.succeed("dawn" as DayPhase)),
        Match.when((t) => t >= 1000 && t < 6000, () => Effect.succeed("morning" as DayPhase)),
        Match.when((t) => t >= 6000 && t < 12000, () => Effect.succeed("day" as DayPhase)),
        Match.when((t) => t >= 12000 && t < 13000, () => Effect.succeed("evening" as DayPhase)),
        Match.when((t) => t >= 13000 && t < 14000, () => Effect.succeed("dusk" as DayPhase)),
        Match.when((t) => t >= 14000 && t < 18000, () => Effect.succeed("night" as DayPhase)),
        Match.when((t) => t >= 18000 && t < 22000, () => Effect.succeed("midnight" as DayPhase)),
        Match.when((t) => t >= 22000 && t < 23000, () => Effect.succeed("late_night" as DayPhase)),
        Match.orElse(() => Effect.succeed("day" as DayPhase))
      )
    })

    const getSkyLightLevel = (gameTime?: GameTime) => Effect.gen(function* () {
      const time = gameTime ?? (yield* getCurrentTime()).gameTime
      const config_ = yield* Ref.get(config)

      if (!config_.doDayLightCycle) {
        return 15 as LightLevel
      }

      // Calculate light level based on time
      // Night: 4, Day: 15, smooth transitions at dawn/dusk
      if (time >= 12542 && time <= 23460) {
        // Night time
        if (time >= 13000 && time <= 23000) {
          return 4 as LightLevel // Full darkness
        } else {
          // Twilight transition
          const transitionProgress = time <= 13000
            ? (13000 - time) / 458  // Dusk transition
            : (time - 23000) / 460  // Dawn transition

          const lightLevel = Math.round(4 + (11 * Math.max(0, Math.min(1, transitionProgress))))
          return lightLevel as LightLevel
        }
      } else {
        // Day time
        return 15 as LightLevel
      }
    })

    const calculateSunPosition = (gameTime: GameTime) => Effect.gen(function* () {
      // Sun moves from east (0°) to west (180°) during the day
      // Time 6000 = noon (90°), Time 18000 = midnight (270°)
      const dayTime = (gameTime + 6000) % 24000
      const sunAngle = (dayTime / 24000) * 360

      // Calculate elevation based on time
      const elevation = Math.sin((dayTime / 12000) * Math.PI) * 90

      const brightness = Math.max(0, Math.sin((dayTime / 12000) * Math.PI))
      const visible = elevation > -6 // Sun is visible when above horizon with some twilight

      return {
        type: "sun" as const,
        position: {
          azimuth: sunAngle,
          elevation: Math.max(-90, elevation)
        },
        brightness,
        visible
      }
    })

    const calculateMoonPosition = (gameTime: GameTime, dayCount: number) => Effect.gen(function* () {
      const config_ = yield* Ref.get(config)

      // Moon is opposite to sun
      const sunPosition = yield* calculateSunPosition(gameTime)
      const moonAzimuth = (sunPosition.position.azimuth + 180) % 360
      const moonElevation = -sunPosition.position.elevation

      // Calculate moon phase (0 = new moon, 0.5 = full moon, 1 = new moon)
      const moonPhase = ((dayCount % config_.moonPhaseLength) / config_.moonPhaseLength)

      // Moon brightness varies with phase
      const phaseBrightness = Math.sin(moonPhase * Math.PI)
      const elevationBrightness = Math.max(0, Math.sin((moonElevation + 90) / 90 * Math.PI))
      const brightness = phaseBrightness * elevationBrightness * 0.7 // Moon is dimmer than sun

      return {
        type: "moon" as const,
        position: {
          azimuth: moonAzimuth,
          elevation: moonElevation
        },
        brightness,
        visible: moonElevation > -6,
        phase: moonPhase
      }
    })

    return {
      getCurrentTime,
      setTime,
      advanceTime,
      getDayPhase,
      getSkyLightLevel,
      calculateSunPosition,
      calculateMoonPosition,
      getTimeMultiplier: () => Effect.map(Ref.get(config), c => c.timeSpeed),
      setTimeMultiplier: (multiplier: number) =>
        Ref.update(config, c => ({ ...c, timeSpeed: Math.max(0, multiplier) })),
      pauseTime: () => Ref.set(isPaused, true),
      resumeTime: () => Ref.set(isPaused, false)
    } as const
  })
)
```

### Light System Integration

光源システムとの統合機能です。

```typescript
// Lighting Engine
interface LightingEngine {
  readonly calculateBlockLightLevel: (
    position: BlockPosition,
    timeState: TimeState
  ) => Effect.Effect<LightLevel, never>

  readonly updateSkyLight: (
    chunks: ReadonlyArray<Chunk>,
    skyLightLevel: LightLevel
  ) => Effect.Effect<ReadonlyArray<Chunk>, LightingError>

  readonly propagateLight: (
    startPosition: BlockPosition,
    lightLevel: LightLevel,
    world: World
  ) => Effect.Effect<World, LightingError>

  readonly calculateShadows: (
    sunPosition: CelestialBody,
    world: World,
    region: BoundingBox
  ) => Effect.Effect<ShadowMap, LightingError>

  readonly renderDynamicLighting: (
    timeState: TimeState,
    renderDistance: number
  ) => Effect.Effect<LightingData, never>
}

export const LightingEngine = Context.GenericTag<LightingEngine>("@app/LightingEngine")

export const LightingEngineLive = Layer.effect(
  LightingEngine,
  Effect.gen(function* () {
    const lightPropagationCache = yield* Ref.make<Map<string, LightLevel>>(new Map())

    const calculateBlockLightLevel = (
      position: BlockPosition,
      timeState: TimeState
    ) => Effect.gen(function* () {
      const cacheKey = `${position.x},${position.y},${position.z}`
      const cached = yield* Effect.map(Ref.get(lightPropagationCache), cache => cache.get(cacheKey))

      if (cached !== undefined) {
        return cached
      }

      // Get world service
      const world = yield* WorldSystem
      const block = yield* world.getBlockAt(position)

      // Calculate sky light contribution
      const skyContribution = yield* calculateSkyLightContribution(position, timeState, world)

      // Calculate block light contribution
      const blockContribution = getBlockLightEmission(block)

      // Combine light sources
      const finalLightLevel = Math.max(skyContribution, blockContribution) as LightLevel

      // Cache result
      yield* Ref.update(lightPropagationCache, cache => cache.set(cacheKey, finalLightLevel))

      return finalLightLevel
    })

    const calculateSkyLightContribution = (
      position: BlockPosition,
      timeState: TimeState,
      world: World
    ) => Effect.gen(function* () {
      // Check if position is exposed to sky
      const isExposedToSky = yield* world.isExposedToSky(position)

      if (!isExposedToSky) {
        // Calculate light filtering through blocks above
        let currentY = position.y + 1
        let lightLevel = timeState.skyLightLevel

        while (currentY < 256 && lightLevel > 0) {
          const blockAbove = yield* world.getBlockAt({
            ...position,
            y: currentY
          })

          const lightReduction = getBlockLightReduction(blockAbove)
          lightLevel = Math.max(0, lightLevel - lightReduction) as LightLevel

          if (lightReduction === 0) break // Transparent block, no further reduction
          currentY++
        }

        return lightLevel
      }

      return timeState.skyLightLevel
    })

    const updateSkyLight = (
      chunks: ReadonlyArray<Chunk>,
      skyLightLevel: LightLevel
    ) => Effect.gen(function* () {
      const updatedChunks = yield* Effect.forEach(
        chunks,
        chunk => updateChunkSkyLight(chunk, skyLightLevel),
        { concurrency: 4 }
      )

      // Clear light propagation cache since sky light changed
      yield* Ref.set(lightPropagationCache, new Map())

      return updatedChunks
    })

    const updateChunkSkyLight = (
      chunk: Chunk,
      skyLightLevel: LightLevel
    ) => Effect.gen(function* () {
      const updatedBlocks = new Map(chunk.blocks)

      // Update sky light for each column in the chunk
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          yield* updateColumnSkyLight(
            chunk.coordinate.x * 16 + x,
            chunk.coordinate.z * 16 + z,
            skyLightLevel,
            updatedBlocks
          )
        }
      }

      return {
        ...chunk,
        blocks: updatedBlocks,
        lastLightUpdate: Date.now()
      }
    })

    const propagateLight = (
      startPosition: BlockPosition,
      lightLevel: LightLevel,
      world: World
    ) => Effect.gen(function* () {
      if (lightLevel <= 0) return world

      const visited = new Set<string>()
      const queue: Array<{position: BlockPosition, light: LightLevel}> = [
        { position: startPosition, light: lightLevel }
      ]

      let updatedWorld = world

      while (queue.length > 0) {
        const { position, light } = queue.shift()!
        const key = `${position.x},${position.y},${position.z}`

        if (visited.has(key) || light <= 0) continue
        visited.add(key)

        // Set light level at current position
        updatedWorld = yield* setBlockLight(updatedWorld, position, light)

        // Propagate to neighbors
        const neighbors = [
          { x: position.x + 1, y: position.y, z: position.z },
          { x: position.x - 1, y: position.y, z: position.z },
          { x: position.x, y: position.y + 1, z: position.z },
          { x: position.x, y: position.y - 1, z: position.z },
          { x: position.x, y: position.y, z: position.z + 1 },
          { x: position.x, y: position.y, z: position.z - 1 }
        ]

        for (const neighbor of neighbors) {
          const neighborBlock = yield* world.getBlockAt(neighbor)
          const lightReduction = getBlockLightReduction(neighborBlock)
          const newLight = Math.max(0, light - lightReduction - 1) as LightLevel

          if (newLight > 0) {
            queue.push({ position: neighbor, light: newLight })
          }
        }
      }

      return updatedWorld
    })

    const calculateShadows = (
      sunPosition: CelestialBody,
      world: World,
      region: BoundingBox
    ) => Effect.gen(function* () {
      const shadowMap: ShadowMap = new Map()

      if (!sunPosition.visible || sunPosition.position.elevation <= 0) {
        // Sun is not visible, everything is in shadow
        for (let x = region.minX; x <= region.maxX; x++) {
          for (let z = region.minZ; z <= region.maxZ; z++) {
            shadowMap.set(`${x},${z}`, 0)
          }
        }
        return shadowMap
      }

      // Calculate shadow casting
      const sunVector = calculateSunVector(sunPosition)

      for (let x = region.minX; x <= region.maxX; x++) {
        for (let z = region.minZ; z <= region.maxZ; z++) {
          const shadowIntensity = yield* calculateShadowAtPosition(
            { x, z },
            sunVector,
            world,
            region
          )
          shadowMap.set(`${x},${z}`, shadowIntensity)
        }
      }

      return shadowMap
    })

    const renderDynamicLighting = (
      timeState: TimeState,
      renderDistance: number
    ) => Effect.gen(function* () {
      const sunPosition = yield* TimeSystem.pipe(
        Effect.flatMap(ts => ts.calculateSunPosition(timeState.gameTime))
      )

      const moonPosition = yield* TimeSystem.pipe(
        Effect.flatMap(ts => ts.calculateMoonPosition(timeState.gameTime, timeState.dayCount))
      )

      // Calculate ambient light color based on time of day
      const ambientColor = calculateAmbientColor(timeState, sunPosition, moonPosition)

      // Calculate fog properties
      const fogProperties = calculateFogProperties(timeState, sunPosition)

      return {
        skyLightLevel: timeState.skyLightLevel,
        sunPosition,
        moonPosition,
        ambientColor,
        fogProperties,
        dynamicShadows: sunPosition.visible && sunPosition.position.elevation > 5,
        renderDistance
      }
    })

    return {
      calculateBlockLightLevel,
      updateSkyLight,
      propagateLight,
      calculateShadows,
      renderDynamicLighting
    } as const
  })
)
```

### Time-Based Entity Behavior

時間に基づくエンティティ行動システムです。

```typescript
// Time-Based Behavior System
interface TimeBehaviorSystem {
  readonly updateMobBehaviors: (
    mobs: ReadonlyArray<MobEntity>,
    timeState: TimeState
  ) => Effect.Effect<ReadonlyArray<MobEntity>, BehaviorError>

  readonly triggerTimeEvents: (
    oldPhase: DayPhase,
    newPhase: DayPhase,
    world: World
  ) => Effect.Effect<World, TimeEventError>

  readonly calculateSpawnRates: (
    timeState: TimeState,
    biome: string
  ) => Effect.Effect<MobSpawnRates, never>

  readonly updatePlantGrowth: (
    plants: ReadonlyArray<PlantEntity>,
    timeState: TimeState,
    deltaTime: number
  ) => Effect.Effect<ReadonlyArray<PlantEntity>, never>

  readonly manageVillagerSchedules: (
    villagers: ReadonlyArray<VillagerEntity>,
    timeState: TimeState
  ) => Effect.Effect<ReadonlyArray<VillagerEntity>, never>
}

export const TimeBehaviorSystem = Context.GenericTag<TimeBehaviorSystem>("@app/TimeBehaviorSystem")

export const TimeBehaviorSystemLive = Layer.effect(
  TimeBehaviorSystem,
  Effect.gen(function* () {
    const mobBehaviorCache = yield* Ref.make<Map<string, MobBehaviorState>>(new Map())

    const updateMobBehaviors = (
      mobs: ReadonlyArray<MobEntity>,
      timeState: TimeState
    ) => Effect.gen(function* () {
      const updatedMobs = yield* Effect.forEach(
        mobs,
        mob => updateSingleMobBehavior(mob, timeState),
        { concurrency: 8 }
      )

      return updatedMobs
    })

    const updateSingleMobBehavior = (
      mob: MobEntity,
      timeState: TimeState
    ) => Effect.gen(function* () {
      const behaviorModifiers = getMobTimeModifiers(mob.type, timeState.dayPhase)

      let updatedMob = mob

      // Apply time-based behavior changes
      updatedMob = yield* Match.value(mob.type).pipe(
        Match.when("zombie", () => Effect.gen(function* () {
          let newMob = mob

          // Hostile mobs burn in daylight
          if (timeState.dayPhase === "day" && timeState.skyLightLevel > 7) {
            const world = yield* WorldSystem
            const mobPosition = mob.position
            const isInSunlight = yield* world.isExposedToSky(mobPosition)

            if (isInSunlight) {
              // Apply burn damage
              newMob = {
                ...mob,
                health: Math.max(0, mob.health - 1),
                statusEffects: [...mob.statusEffects, {
                  type: "burning",
                  duration: 100,
                  amplifier: 1
                }]
              }
            }
          }

          // Increase aggression at night
          if (timeState.dayPhase === "night" || timeState.dayPhase === "midnight") {
            newMob = {
              ...newMob,
              aggressionLevel: Math.min(newMob.aggressionLevel + 0.2, 1.0),
              detectionRange: newMob.detectionRange * 1.3
            }
          }

          return newMob
        })),
        Match.when("skeleton", () => Effect.gen(function* () {
          let newMob = mob

          // Hostile mobs burn in daylight
          if (timeState.dayPhase === "day" && timeState.skyLightLevel > 7) {
            const world = yield* WorldSystem
            const mobPosition = mob.position
            const isInSunlight = yield* world.isExposedToSky(mobPosition)

            if (isInSunlight) {
              // Apply burn damage
              newMob = {
                ...mob,
                health: Math.max(0, mob.health - 1),
                statusEffects: [...mob.statusEffects, {
                  type: "burning",
                  duration: 100,
                  amplifier: 1
                }]
              }
            }
          }

          // Increase aggression at night
          if (timeState.dayPhase === "night" || timeState.dayPhase === "midnight") {
            newMob = {
              ...newMob,
              aggressionLevel: Math.min(newMob.aggressionLevel + 0.2, 1.0),
              detectionRange: newMob.detectionRange * 1.3
            }
          }

          return newMob
        })),
        Match.when("spider", () => Effect.gen(function* () {
          let newMob = mob

          // Hostile mobs burn in daylight
          if (timeState.dayPhase === "day" && timeState.skyLightLevel > 7) {
            const world = yield* WorldSystem
            const mobPosition = mob.position
            const isInSunlight = yield* world.isExposedToSky(mobPosition)

            if (isInSunlight) {
              // Apply burn damage
              newMob = {
                ...mob,
                health: Math.max(0, mob.health - 1),
                statusEffects: [...mob.statusEffects, {
                  type: "burning",
                  duration: 100,
                  amplifier: 1
                }]
              }
            }
          }

          // Increase aggression at night
          if (timeState.dayPhase === "night" || timeState.dayPhase === "midnight") {
            newMob = {
              ...newMob,
              aggressionLevel: Math.min(newMob.aggressionLevel + 0.2, 1.0),
              detectionRange: newMob.detectionRange * 1.3
            }
          }

          return newMob
        })),
        Match.when("enderman", () => Effect.gen(function* () {
          let newMob = mob

          // Endermen are more active at night and teleport more frequently
          if (timeState.dayPhase === "night" || timeState.dayPhase === "midnight") {
            newMob = {
              ...mob,
              movementSpeed: mob.movementSpeed * 1.2,
              teleportCooldown: mob.teleportCooldown * 0.7
            }
          }

          return newMob
        })),
        Match.when("villager", () => updateVillagerSchedule(mob, timeState)),
        Match.when("animal", () => Effect.gen(function* () {
          // Animals are more active during day
          if (timeState.dayPhase === "day" || timeState.dayPhase === "morning") {
            return {
              ...mob,
              movementSpeed: mob.movementSpeed * 1.1,
              breeding: true
            }
          } else {
            return {
              ...mob,
              movementSpeed: mob.movementSpeed * 0.8,
              breeding: false
            }
          }
        })),
        Match.orElse(() => Effect.succeed(mob))
      )

      return updatedMob
    })

    const updateVillagerSchedule = (
      villager: VillagerEntity,
      timeState: TimeState
    ) => Effect.gen(function* () {
      const schedule = getVillagerSchedule(villager.profession, timeState.dayPhase)

      return {
        ...villager,
        currentActivity: schedule.activity,
        workstationTarget: schedule.workstation,
        bedTarget: schedule.bedTarget,
        movementSpeed: schedule.movementSpeedModifier * villager.baseMovementSpeed,
        tradeAvailable: schedule.canTrade
      }
    })

    const triggerTimeEvents = (
      oldPhase: DayPhase,
      newPhase: DayPhase,
      world: World
    ) => Effect.gen(function* () {
      let updatedWorld = world

      // Handle phase transition events
      if (oldPhase !== newPhase) {
        yield* Effect.log(`Time phase changed from ${oldPhase} to ${newPhase}`)

        updatedWorld = yield* Match.value(newPhase).pipe(
          Match.when("dawn", () => Effect.gen(function* () {
            // Roosters crow, hostile mobs start burning
            return yield* triggerDawnEvents(updatedWorld)
          })),
          Match.when("day", () => Effect.gen(function* () {
            // Villagers start working, animals become active
            return yield* triggerDayEvents(updatedWorld)
          })),
          Match.when("dusk", () => Effect.gen(function* () {
            // Villagers return home, hostile mobs spawn
            return yield* triggerDuskEvents(updatedWorld)
          })),
          Match.when("night", () => Effect.gen(function* () {
            // Hostile mob spawning increases, villagers sleep
            return yield* triggerNightEvents(updatedWorld)
          })),
          Match.orElse(() => Effect.succeed(updatedWorld))
        )
      }

      return updatedWorld
    })

    const calculateSpawnRates = (
      timeState: TimeState,
      biome: string
    ) => Effect.gen(function* () {
      const baseRates = getBiomeSpawnRates(biome)
      const timeModifiers = getTimeSpawnModifiers(timeState.dayPhase)
      const lightModifiers = getLightSpawnModifiers(timeState.skyLightLevel)

      return {
        hostile: baseRates.hostile * timeModifiers.hostile * lightModifiers.hostile,
        neutral: baseRates.neutral * timeModifiers.neutral,
        passive: baseRates.passive * timeModifiers.passive,
        ambient: baseRates.ambient
      }
    })

    const updatePlantGrowth = (
      plants: ReadonlyArray<PlantEntity>,
      timeState: TimeState,
      deltaTime: number
    ) => Effect.gen(function* () {
      const growthModifier = getPlantGrowthModifier(timeState)

      return plants.map(plant => {
        const growthRate = plant.baseGrowthRate * growthModifier * (deltaTime / 1000)
        const newGrowthProgress = Math.min(plant.maxGrowth, plant.currentGrowth + growthRate)

        return {
          ...plant,
          currentGrowth: newGrowthProgress,
          needsUpdate: newGrowthProgress !== plant.currentGrowth
        }
      })
    })

    return {
      updateMobBehaviors,
      triggerTimeEvents,
      calculateSpawnRates,
      updatePlantGrowth,
      manageVillagerSchedules: (villagers, timeState) => Effect.gen(function* () {
        return yield* Effect.forEach(
          villagers,
          villager => updateVillagerSchedule(villager, timeState)
        )
      })
    } as const
  })
)
```

### Sky Rendering System

空の描画システムです。

```typescript
// Sky Rendering System
interface SkyRenderingSystem {
  readonly renderSkybox: (
    timeState: TimeState,
    weather: WeatherState,
    camera: CameraState
  ) => Effect.Effect<SkyboxData, never>

  readonly generateStarField: (
    timeState: TimeState,
    latitude: number
  ) => Effect.Effect<StarFieldData, never>

  readonly calculateSkyColors: (
    timeState: TimeState,
    sunPosition: CelestialBody,
    weather: WeatherState
  ) => Effect.Effect<SkyColorPalette, never>

  readonly renderClouds: (
    timeState: TimeState,
    weather: WeatherState,
    windVector: { x: number; z: number }
  ) => Effect.Effect<CloudData, never>

  readonly createAtmosphericEffects: (
    timeState: TimeState,
    viewDistance: number
  ) => Effect.Effect<AtmosphericEffects, never>
}

export const SkyRenderingSystem = Context.GenericTag<SkyRenderingSystem>("@app/SkyRenderingSystem")

export const SkyRenderingSystemLive = Layer.effect(
  SkyRenderingSystem,
  Effect.gen(function* () {
    const starFieldCache = yield* Ref.make<Map<string, StarFieldData>>(new Map())
    const cloudAnimationTime = yield* Ref.make(0)

    const renderSkybox = (
      timeState: TimeState,
      weather: WeatherState,
      camera: CameraState
    ) => Effect.gen(function* () {
      const timeSystem = yield* TimeSystem
      const sunPosition = yield* timeSystem.calculateSunPosition(timeState.gameTime)
      const moonPosition = yield* timeSystem.calculateMoonPosition(
        timeState.gameTime,
        timeState.dayCount
      )

      const skyColors = yield* calculateSkyColors(timeState, sunPosition, weather)
      const starField = yield* generateStarField(timeState, camera.latitude)
      const clouds = yield* renderClouds(timeState, weather, { x: 1, z: 0.5 })

      return {
        sunPosition,
        moonPosition,
        skyColors,
        starField,
        clouds,
        fogDensity: calculateFogDensity(timeState, weather),
        ambientLightColor: skyColors.ambient,
        horizonColor: skyColors.horizon,
        zenithColor: skyColors.zenith
      }
    })

    const generateStarField = (
      timeState: TimeState,
      latitude: number
    ) => Effect.gen(function* () {
      const cacheKey = `${Math.floor(timeState.dayCount / 10)}_${Math.floor(latitude)}`
      const cached = yield* Effect.map(Ref.get(starFieldCache), cache => cache.get(cacheKey))

      if (cached) {
        return {
          ...cached,
          visibility: calculateStarVisibility(timeState),
          twinklePhase: (timeState.currentTick % 100) / 100
        }
      }

      // Generate star positions using deterministic random
      const seed = hashString(cacheKey)
      const starCount = 1000
      const stars: Star[] = []

      for (let i = 0; i < starCount; i++) {
        const starSeed = seed + i

        // Generate star position on celestial sphere
        const azimuth = (hashNumber(starSeed) % 360)
        const elevation = (hashNumber(starSeed + 1000) % 180) - 90

        // Adjust for latitude (stars near poles are visible longer)
        const adjustedElevation = elevation + (latitude * 0.5)

        if (adjustedElevation < -20) continue // Don't render stars too far below horizon

        const brightness = 0.3 + (hashNumber(starSeed + 2000) % 70) / 100
        const color = getStarColor(hashNumber(starSeed + 3000) % 5)

        stars.push({
          position: { azimuth, elevation: adjustedElevation },
          brightness,
          color,
          twinkleRate: 0.5 + (hashNumber(starSeed + 4000) % 50) / 100
        })
      }

      const starField: StarFieldData = {
        stars,
        visibility: calculateStarVisibility(timeState),
        twinklePhase: 0,
        constellations: generateConstellations(stars, seed)
      }

      yield* Ref.update(starFieldCache, cache => cache.set(cacheKey, starField))
      return starField
    })

    const calculateSkyColors = (
      timeState: TimeState,
      sunPosition: CelestialBody,
      weather: WeatherState
    ) => Effect.gen(function* () {
      const baseColors = getSkyColorForTime(timeState.dayPhase)
      const sunInfluence = calculateSunColorInfluence(sunPosition)
      const weatherModifier = getWeatherColorModifier(weather)

      // Interpolate colors based on sun position and weather
      const zenithColor = blendColors([
        baseColors.zenith,
        sunInfluence.zenith,
        weatherModifier.zenith
      ])

      const horizonColor = blendColors([
        baseColors.horizon,
        sunInfluence.horizon,
        weatherModifier.horizon
      ])

      const ambientColor = blendColors([
        baseColors.ambient,
        sunInfluence.ambient,
        weatherModifier.ambient
      ])

      return {
        zenith: zenithColor,
        horizon: horizonColor,
        ambient: ambientColor,
        fog: calculateFogColor(timeState, sunPosition, weather),
        sunColor: calculateSunColor(sunPosition),
        moonColor: calculateMoonColor(timeState.dayCount)
      }
    })

    const renderClouds = (
      timeState: TimeState,
      weather: WeatherState,
      windVector: { x: number; z: number }
    ) => Effect.gen(function* () {
      const animTime = yield* Ref.updateAndGet(
        cloudAnimationTime,
        t => t + (16.67 * windVector.x) // Assume 60fps, move clouds with wind
      )

      const cloudLayers: CloudLayer[] = []

      // High altitude clouds
      cloudLayers.push({
        altitude: 200,
        coverage: weather.cloudCoverage * 0.3,
        density: 0.4,
        speed: windVector.x * 0.5,
        animationOffset: animTime * 0.001,
        color: getCloudColor(timeState, 200),
        shadows: false
      })

      // Mid altitude clouds
      cloudLayers.push({
        altitude: 150,
        coverage: weather.cloudCoverage * 0.6,
        density: 0.7,
        speed: windVector.x,
        animationOffset: animTime * 0.002,
        color: getCloudColor(timeState, 150),
        shadows: true
      })

      // Low altitude clouds (fog/mist)
      if (weather.condition === "fog" || weather.humidity > 80) {
        cloudLayers.push({
          altitude: 80,
          coverage: 0.9,
          density: 0.3,
          speed: windVector.x * 0.2,
          animationOffset: animTime * 0.0005,
          color: getFogColor(timeState),
          shadows: false
        })
      }

      return {
        layers: cloudLayers,
        windVector,
        animationTime: animTime,
        lightingDirection: {
          x: Math.cos(timeState.sunAngle * Math.PI / 180),
          y: Math.sin(timeState.sunAngle * Math.PI / 180),
          z: 0
        }
      }
    })

    const createAtmosphericEffects = (
      timeState: TimeState,
      viewDistance: number
    ) => Effect.gen(function* () {
      const scatteringCoefficient = calculateRayleighScattering(timeState)
      const mieScattering = calculateMieScattering(timeState)

      return {
        rayleighScattering: scatteringCoefficient,
        mieScattering,
        atmosphericPerspective: {
          nearColor: { r: 1, g: 1, b: 1, a: 0 },
          farColor: calculateHorizonColor(timeState),
          startDistance: viewDistance * 0.7,
          endDistance: viewDistance
        },
        sunScattering: calculateSunScattering(timeState),
        airDensity: 1.0, // Can be modified by altitude
        humidity: 0.5    // Can be linked to weather system
      }
    })

    return {
      renderSkybox,
      generateStarField,
      calculateSkyColors,
      renderClouds,
      createAtmosphericEffects
    } as const
  })
)
```

## Layer構成

```typescript
// Day/Night Cycle Layer
export const DayNightCycleLayer = Layer.mergeAll(
  TimeSystemLive,
  LightingEngineLive,
  TimeBehaviorSystemLive,
  SkyRenderingSystemLive
).pipe(
  Layer.provide(WorldSystemLayer),
  Layer.provide(EventBusLayer)
)
```

## 使用例

```typescript
// Day/Night Cycle の使用例
const exampleDayNightCycle = Effect.gen(function* () {
  const timeSystem = yield* TimeSystem
  const lightingEngine = yield* LightingEngine
  const behaviorSystem = yield* TimeBehaviorSystem

  // 現在時刻を取得
  const currentTime = yield* timeSystem.getCurrentTime()
  yield* Effect.log(`Current game time: ${currentTime.gameTime} (${currentTime.dayPhase})`)

  // 時間を進める（1分 = 1200 ticks）
  const newTime = yield* timeSystem.advanceTime(1200)
  yield* Effect.log(`Advanced to: ${newTime.gameTime} (${newTime.dayPhase})`)

  // 太陽と月の位置を計算
  const sunPosition = yield* timeSystem.calculateSunPosition(newTime.gameTime)
  const moonPosition = yield* timeSystem.calculateMoonPosition(newTime.gameTime, newTime.dayCount)

  yield* Effect.log(`Sun: ${sunPosition.position.azimuth}° azimuth, ${sunPosition.position.elevation}° elevation`)
  yield* Effect.log(`Moon phase: ${moonPosition.phase?.toFixed(2)}`)

  // 光レベルの更新
  const world = yield* WorldSystem
  const chunks = yield* world.getLoadedChunks()
  const updatedChunks = yield* lightingEngine.updateSkyLight(chunks, newTime.skyLightLevel)

  yield* Effect.log(`Updated lighting for ${updatedChunks.length} chunks`)

  // Mobの行動更新
  const mobs = yield* world.getAllMobs()
  const updatedMobs = yield* behaviorSystem.updateMobBehaviors(mobs, newTime)

  yield* Effect.log(`Updated behavior for ${updatedMobs.length} mobs`)

  // 時間変化によるイベントの発生
  if (currentTime.dayPhase !== newTime.dayPhase) {
    const updatedWorld = yield* behaviorSystem.triggerTimeEvents(
      currentTime.dayPhase,
      newTime.dayPhase,
      world
    )
    yield* Effect.log(`Triggered time events for phase transition`)
  }

  return newTime
})

// 自動時間進行システム
const startAutomaticTimeProgression = Effect.gen(function* () {
  const timeSystem = yield* TimeSystem

  const timeLoop = Effect.gen(function* () {
    while (true) {
      // 50ms毎に1tick進める（20 TPS）
      yield* timeSystem.advanceTime(1)
      yield* Effect.sleep(50)
    }
  })

  const fiber = yield* Effect.fork(timeLoop)
  yield* Effect.log("Automatic time progression started")

  return fiber
})
```

## パフォーマンス最適化

### 段階的光源更新

```typescript
// 効率的な光源計算
export const createLightUpdateScheduler = Effect.gen(function* () {
  const updateQueue = yield* Queue.bounded<LightUpdateTask>(1000)
  const priorityQueue = yield* Queue.bounded<LightUpdateTask>(100)

  const processingFiber = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        // 優先度の高い更新を最初に処理
        const priorityTask = yield* Queue.takeOption(priorityQueue)
        if (priorityTask._tag === "Some") {
          yield* processLightUpdate(priorityTask.value)
        }

        // 通常の更新を処理
        const normalTask = yield* Queue.takeUpTo(updateQueue, 10) // 1フレームで最大10個
        yield* Effect.forEach(
          normalTask,
          processLightUpdate,
          { concurrency: 4 }
        )

        yield* Effect.sleep(16) // 60fps制限
      })
    )
  )

  return {
    scheduleUpdate: (task: LightUpdateTask) => Queue.offer(updateQueue, task),
    schedulePriorityUpdate: (task: LightUpdateTask) => Queue.offer(priorityQueue, task),
    shutdown: () => Fiber.interrupt(processingFiber)
  }
})
```

### 動的品質調整

```typescript
// 時間システムの品質調整
export const adaptiveTimeQuality = (
  performanceMetrics: PerformanceMetrics
) => Effect.gen(function* () {
  const timeSystem = yield* TimeSystem

  if (performanceMetrics.averageFPS < 30) {
    // パフォーマンスが低下している場合
    yield* timeSystem.setTimeMultiplier(0.5) // 時間進行を半分に
    yield* Effect.log("Reduced time simulation quality due to low FPS")
  } else if (performanceMetrics.averageFPS > 55) {
    // パフォーマンスに余裕がある場合
    yield* timeSystem.setTimeMultiplier(1.0) // 通常の時間進行
  }
})
```

## テスト戦略

```typescript
describe("Day/Night Cycle System", () => {
  const TestDayNightLayer = Layer.mergeAll(
    DayNightCycleLayer,
    TestWorldLayer
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  it("should correctly calculate day phases", () =>
    Effect.gen(function* () {
      const timeSystem = yield* TimeSystem

      // Test dawn
      yield* timeSystem.setTime(0 as GameTime)
      const dawnPhase = yield* timeSystem.getDayPhase()
      expect(dawnPhase).toBe("dawn")

      // Test day
      yield* timeSystem.setTime(8000 as GameTime)
      const dayPhase = yield* timeSystem.getDayPhase()
      expect(dayPhase).toBe("day")

      // Test night
      yield* timeSystem.setTime(16000 as GameTime)
      const nightPhase = yield* timeSystem.getDayPhase()
      expect(nightPhase).toBe("night")
    }).pipe(
      Effect.provide(TestDayNightLayer),
      Effect.runPromise
    ))

  it("should update light levels correctly", () =>
    Effect.gen(function* () {
      const timeSystem = yield* TimeSystem
      const lightingEngine = yield* LightingEngine

      // Set time to noon
      yield* timeSystem.setTime(6000 as GameTime)
      const noonLight = yield* timeSystem.getSkyLightLevel()
      expect(noonLight).toBe(15)

      // Set time to midnight
      yield* timeSystem.setTime(18000 as GameTime)
      const midnightLight = yield* timeSystem.getSkyLightLevel()
      expect(midnightLight).toBe(4)
    }).pipe(
      Effect.provide(TestDayNightLayer),
      Effect.runPromise
    ))

  it("should trigger mob behavior changes", () =>
    Effect.gen(function* () {
      const behaviorSystem = yield* TimeBehaviorSystem

      const zombieMob: MobEntity = {
        id: "test-zombie",
        type: "zombie",
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        maxHealth: 20,
        aggressionLevel: 0.5,
        detectionRange: 16,
        statusEffects: []
      }

      const dayTime: TimeState = {
        currentTick: 8000 as GameTick,
        gameTime: 8000 as GameTime,
        dayPhase: "day",
        dayCount: 1,
        sunAngle: 90,
        moonAngle: 270,
        skyLightLevel: 15 as LightLevel,
        timestamp: new Date()
      }

      const [updatedMob] = yield* behaviorSystem.updateMobBehaviors([zombieMob], dayTime)

      // Zombie should take damage in daylight
      expect(updatedMob.statusEffects.some(e => e.type === "burning")).toBe(true)
    }).pipe(
      Effect.provide(TestDayNightLayer),
      Effect.runPromise
    ))
})
```

このDay/Night Cycleシステムは、Minecraftの世界に動的な時間の流れと、それに連動する様々なゲームメカニクスを提供します。Effect-TSの関数型プログラミングパターンを活用することで、複雑な時間管理と光源計算を効率的かつ安全に実装し、プレイヤーに豊かな体験を届けます。