# Weather System - 動的天候システム

## 概要

Weather Systemは、Minecraftの世界に動的で没入感のある天候体験を提供する高度なシステムです。リアルタイムの気象シミュレーション、降水効果、雷システム、季節変化、そしてバイオーム固有の天候パターンを実装します。Effect-TSのStreamとSignalを活用し、連続的な天候変化とイベントベースの気象現象を実現します。

## システム設計原理

### Weather State Management

天候状態を管理する包括的なシステムです。

```typescript
import { Effect, Layer, Context, Stream, Signal, Schema, pipe } from "effect"
import { Brand } from "effect"

// Domain Types
export type Temperature = Brand.Brand<number, "Temperature"> // Celsius
export const Temperature = pipe(
  Schema.Number,
  Schema.between(-50, 60),
  Schema.brand("Temperature")
)

export type Humidity = Brand.Brand<number, "Humidity"> // 0-100%
export const Humidity = pipe(
  Schema.Number,
  Schema.between(0, 100),
  Schema.brand("Humidity")
)

export type Pressure = Brand.Brand<number, "Pressure"> // hPa
export const Pressure = pipe(
  Schema.Number,
  Schema.between(950, 1050),
  Schema.brand("Pressure")
)

export type WindSpeed = Brand.Brand<number, "WindSpeed"> // m/s
export const WindSpeed = pipe(
  Schema.Number,
  Schema.between(0, 50),
  Schema.brand("WindSpeed")
)

export type CloudCoverage = Brand.Brand<number, "CloudCoverage"> // 0-100%
export const CloudCoverage = pipe(
  Schema.Number,
  Schema.between(0, 100),
  Schema.brand("CloudCoverage")
)

// Weather States
export const WeatherCondition = Schema.Literal(
  "clear",
  "partly_cloudy",
  "overcast",
  "light_rain",
  "heavy_rain",
  "drizzle",
  "thunderstorm",
  "light_snow",
  "heavy_snow",
  "blizzard",
  "fog",
  "sandstorm"
)

export type WeatherCondition = Schema.Schema.Type<typeof WeatherCondition>

// Weather Data
export const WeatherState = Schema.Struct({
  condition: WeatherCondition,
  temperature: Temperature,
  humidity: Humidity,
  pressure: Pressure,
  windSpeed: WindSpeed,
  windDirection: pipe(Schema.Number, Schema.between(0, 360)), // degrees
  cloudCoverage: CloudCoverage,
  precipitationIntensity: pipe(Schema.Number, Schema.between(0, 1)),
  visibility: pipe(Schema.Number, Schema.between(0, 1000)), // meters
  timestamp: Schema.DateTimeUtc
})

export type WeatherState = Schema.Schema.Type<typeof WeatherState>

// Regional Weather
export const RegionalWeather = Schema.Struct({
  regionId: Schema.String,
  biome: Schema.String,
  weatherState: WeatherState,
  microclimate: Schema.Struct({
    temperature_modifier: Schema.Number,
    humidity_modifier: Schema.Number,
    precipitation_modifier: Schema.Number
  }),
  elevation: Schema.Number,
  latitude: pipe(Schema.Number, Schema.between(-90, 90)),
  longitude: pipe(Schema.Number, Schema.between(-180, 180))
})

export type RegionalWeather = Schema.Schema.Type<typeof RegionalWeather>

// Seasonal Data
export const Season = Schema.Literal("spring", "summer", "autumn", "winter")
export type Season = Schema.Schema.Type<typeof Season>

export const SeasonalModifiers = Schema.Struct({
  season: Season,
  temperatureModifier: Schema.Number,
  humidityModifier: Schema.Number,
  precipitationModifier: Schema.Number,
  daylightModifier: Schema.Number,
  stormFrequencyModifier: Schema.Number
})

export type SeasonalModifiers = Schema.Schema.Type<typeof SeasonalModifiers>
```

### Weather Generation Engine

プロシージャル天候生成エンジンです。

```typescript
// Weather Generation Errors
export class WeatherGenerationError extends Schema.TaggedError("WeatherGenerationError")<{
  message: string
  cause?: unknown
  timestamp: number
}> {}

export class PredictionError extends Schema.TaggedError("PredictionError")<{
  message: string
  hoursAhead: number
  timestamp: number
}> {}

export class LightningError extends Schema.TaggedError("LightningError")<{
  message: string
  strikeId?: string
  timestamp: number
}> {}

export class ClimateSimulationError extends Schema.TaggedError("ClimateSimulationError")<{
  message: string
  region?: string
  timestamp: number
}> {}

// Weather Generation System
interface WeatherGeneratorInterface {
  readonly generateWeatherPattern: (
    region: RegionalWeather,
    timespan: number
  ) => Effect.Effect<Stream.Stream<WeatherState, never>, WeatherGenerationError>
  readonly calculateSeasonalInfluence: (
    baseWeather: WeatherState,
    season: Season,
    dayOfYear: number
  ) => Effect.Effect<WeatherState, never>
  readonly simulateWeatherTransition: (
    from: WeatherState,
    to: WeatherState,
    duration: number
  ) => Effect.Effect<Stream.Stream<WeatherState, never>, never>
  readonly generateExtremeWeatherEvent: (
    conditions: WeatherState,
    eventType: "thunderstorm" | "blizzard" | "tornado"
  ) => Effect.Effect<WeatherState, WeatherGenerationError>
  readonly predictWeather: (
    currentState: WeatherState,
    hoursAhead: number
  ) => Effect.Effect<ReadonlyArray<WeatherState>, PredictionError>
}

const WeatherGenerator = Context.GenericTag<WeatherGeneratorInterface>("@app/WeatherGenerator")

export const WeatherGeneratorLive = Layer.effect(
  WeatherGenerator,
  Effect.gen(function* () {
    const noiseGenerator = yield* createPerlinNoise(12345)

    const generateWeatherPattern = (
      region: RegionalWeather,
      timespan: number
    ) => Effect.gen(function* () {
      const basePattern = yield* generateBaseWeatherPattern(
        region.biome,
        region.latitude,
        timespan
      )

      return Stream.fromIterable(basePattern).pipe(
        Stream.map(weather => applyRegionalModifiers(weather, region)),
        Stream.map(weather => addNaturalVariation(weather, noiseGenerator))
      )
    })

    const generateBaseWeatherPattern = (
      biome: string,
      latitude: number,
      timespan: number
    ) => Effect.gen(function* () {
      const patterns: WeatherState[] = []
      const biomeProfile = getBiomeWeatherProfile(biome)

      for (let hour = 0; hour < timespan; hour++) {
        const time = hour / timespan

        // Base temperature cycle
        const temperature = calculateTemperature(latitude, time, biomeProfile)

        // Humidity patterns
        const humidity = calculateHumidity(temperature, biome, time)

        // Pressure systems
        const pressure = calculatePressure(latitude, time, noiseGenerator)

        // Cloud formation
        const cloudCoverage = calculateCloudCoverage(humidity, pressure, temperature)

        // Precipitation probability
        const precipitationChance = calculatePrecipitationChance(
          humidity,
          cloudCoverage,
          pressure
        )

        const condition = determineWeatherCondition(
          temperature,
          humidity,
          cloudCoverage,
          precipitationChance
        )

        patterns.push({
          condition,
          temperature,
          humidity,
          pressure,
          windSpeed: calculateWindSpeed(pressure) as WindSpeed,
          windDirection: calculateWindDirection(pressure, latitude),
          cloudCoverage,
          precipitationIntensity: precipitationChance,
          visibility: calculateVisibility(condition, humidity),
          timestamp: new Date(Date.now() + hour * 60 * 60 * 1000)
        })
      }

      return patterns
    })

    const calculateSeasonalInfluence = (
      baseWeather: WeatherState,
      season: Season,
      dayOfYear: number
    ) => Effect.succeed({
      ...baseWeather,
      temperature: applySeasonalTemperature(baseWeather.temperature, season, dayOfYear),
      humidity: applySeasonalHumidity(baseWeather.humidity, season),
      precipitationIntensity: applySeasonalPrecipitation(
        baseWeather.precipitationIntensity,
        season
      )
    })

    const simulateWeatherTransition = (
      from: WeatherState,
      to: WeatherState,
      duration: number
    ) => Effect.succeed(
      Stream.range(0, duration).pipe(
        Stream.map(step => {
          const progress = step / duration
          return interpolateWeatherState(from, to, progress)
        })
      )
    )

    const generateExtremeWeatherEvent = (
      conditions: WeatherState,
      eventType: "thunderstorm" | "blizzard" | "tornado"
    ) => Effect.gen(function* () {
      // 早期リターン: 無効な条件をチェック
      if (eventType === "blizzard" && conditions.temperature > 0) {
        return yield* Effect.fail(new WeatherGenerationError(
          "Cannot generate blizzard in warm conditions"
        ))
      }

      return yield* Match.value(eventType).pipe(
        Match.when("thunderstorm", () => Effect.succeed({
          ...conditions,
          condition: "thunderstorm" as const,
          precipitationIntensity: Math.min(1, conditions.precipitationIntensity + 0.7),
          windSpeed: Math.max(conditions.windSpeed, 15) as WindSpeed,
          pressure: Math.min(conditions.pressure, 980) as Pressure,
          visibility: Math.min(conditions.visibility, 500)
        })),
        Match.when("blizzard", () => Effect.succeed({
          ...conditions,
          condition: "blizzard" as const,
          precipitationIntensity: 0.9,
          windSpeed: Math.max(conditions.windSpeed, 25) as WindSpeed,
          visibility: Math.min(conditions.visibility, 100)
        })),
        Match.when("tornado", () => Effect.succeed({
          ...conditions,
          condition: "thunderstorm" as const,
          windSpeed: Math.max(conditions.windSpeed, 40) as WindSpeed,
          pressure: Math.min(conditions.pressure, 960) as Pressure,
          visibility: Math.min(conditions.visibility, 200)
        })),
        Match.exhaustive
      )
    })

    const predictWeather = (
      currentState: WeatherState,
      hoursAhead: number
    ) => Effect.gen(function* () {
      const predictions: WeatherState[] = []
      let state = currentState

      for (let hour = 1; hour <= hoursAhead; hour++) {
        // Simple weather prediction using persistence and trend analysis
        const trendFactor = calculateWeatherTrend(state)
        const seasonalFactor = calculateSeasonalFactor(hour)

        state = {
          ...state,
          temperature: predictTemperature(state.temperature, trendFactor, seasonalFactor),
          humidity: predictHumidity(state.humidity, trendFactor),
          pressure: predictPressure(state.pressure, trendFactor),
          cloudCoverage: predictCloudCoverage(state.cloudCoverage, state.humidity),
          precipitationIntensity: predictPrecipitation(
            state.precipitationIntensity,
            state.cloudCoverage,
            state.pressure
          ),
          timestamp: new Date(currentState.timestamp.getTime() + hour * 60 * 60 * 1000)
        }

        state = {
          ...state,
          condition: determineWeatherCondition(
            state.temperature,
            state.humidity,
            state.cloudCoverage,
            state.precipitationIntensity
          )
        }

        predictions.push(state)
      }

      return predictions
    })

    return {
      generateWeatherPattern,
      calculateSeasonalInfluence,
      simulateWeatherTransition,
      generateExtremeWeatherEvent,
      predictWeather
    } as const
  })
)
```

### Precipitation System

降水システムの詳細実装です。

```typescript
// Precipitation Effects
export const PrecipitationType = Schema.Literal("rain", "snow", "hail", "sleet")
export type PrecipitationType = Schema.Schema.Type<typeof PrecipitationType>

export const Precipitation = Schema.Struct({
  type: PrecipitationType,
  intensity: Schema.Number.pipe(Schema.between(0, 1)),
  dropletSize: Schema.Number.pipe(Schema.between(0.1, 5)), // mm
  fallVelocity: Schema.Number.pipe(Schema.between(1, 20)), // m/s
  coverage: Schema.Number.pipe(Schema.between(0, 1)),
  duration: Schema.Number, // seconds
  startTime: Schema.DateTimeUtc,
  affectedArea: Schema.Struct({
    center: Schema.Struct({
      x: Schema.Number,
      z: Schema.Number
    }),
    radius: Schema.Number
  })
})

export type Precipitation = Schema.Schema.Type<typeof Precipitation>

interface PrecipitationSystemInterface {
  readonly startPrecipitation: (
    precipitation: Precipitation,
    world: World
  ) => Effect.Effect<Fiber.RuntimeFiber<never, never>, never>
  readonly updatePrecipitation: (
    precipitationId: string,
    intensity: number
  ) => Effect.Effect<void, never>
  readonly stopPrecipitation: (
    precipitationId: string
  ) => Effect.Effect<void, never>
  readonly calculateGroundAccumulation: (
    precipitation: Precipitation,
    terrain: TerrainData
  ) => Effect.Effect<AccumulationMap, never>
  readonly simulateRunoff: (
    accumulation: AccumulationMap,
    terrain: TerrainData
  ) => Effect.Effect<WaterFlow, never>
}

const PrecipitationSystem = Context.GenericTag<PrecipitationSystemInterface>("@app/PrecipitationSystem")

export const PrecipitationSystemLive = Layer.effect(
  PrecipitationSystem,
  Effect.gen(function* () {
    const activePrecipitation = yield* Ref.make<Map<string, Precipitation>>(new Map())
    const particleSystem = yield* ParticleSystem

    const startPrecipitation = (
      precipitation: Precipitation,
      world: World
    ) => Effect.gen(function* () {
      const precipitationId = crypto.randomUUID()

      yield* Ref.update(activePrecipitation, map =>
        map.set(precipitationId, precipitation)
      )

      const simulationFiber = yield* Effect.fork(
        precipitationSimulation(precipitationId, precipitation, world)
      )

      return simulationFiber
    })

    const precipitationSimulation = (
      precipitationId: string,
      precipitation: Precipitation,
      world: World
    ) => Effect.gen(function* () {
      const startTime = Date.now()

      while (true) {
        const elapsed = Date.now() - startTime
        if (elapsed > precipitation.duration * 1000) {
          yield* stopPrecipitation(precipitationId)
          break
        }

        // Generate precipitation particles
        const particles = yield* generatePrecipitationParticles(
          precipitation,
          world.currentTime
        )

        // Add particles to rendering system
        yield* Effect.forEach(
          particles,
          particle => particleSystem.addParticle(particle),
          { concurrency: "unbounded" }
        )

        // Update ground moisture and accumulation
        yield* updateGroundEffects(precipitation, world, elapsed)

        // 50ms update interval
        yield* Effect.sleep(50)
      }
    })

    const generatePrecipitationParticles = (
      precipitation: Precipitation,
      currentTime: Date
    ) => Effect.gen(function* () {
      const particles: PrecipitationParticle[] = []
      const { center, radius } = precipitation.affectedArea
      const particleCount = Math.floor(precipitation.intensity * 1000)

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * 2 * Math.PI
        const distance = Math.random() * radius
        const x = center.x + Math.cos(angle) * distance
        const z = center.z + Math.sin(angle) * distance

        // Find ground level
        const y = yield* getGroundLevel(x, z)

        const particle: PrecipitationParticle = {
          id: crypto.randomUUID(),
          type: precipitation.type,
          position: { x, y: y + 50, z },
          velocity: {
            x: Math.random() * 2 - 1, // Wind effect
            y: -precipitation.fallVelocity,
            z: Math.random() * 2 - 1
          },
          size: precipitation.dropletSize,
          lifespan: calculateDropletLifespan(precipitation),
          createdAt: currentTime
        }

        particles.push(particle)
      }

      return particles
    })

    const calculateGroundAccumulation = (
      precipitation: Precipitation,
      terrain: TerrainData
    ) => Effect.gen(function* () {
      const accumulationMap: AccumulationMap = new Map()
      const { center, radius } = precipitation.affectedArea

      // Grid-based accumulation calculation
      const gridSize = 1 // 1 block resolution
      const steps = Math.ceil(radius * 2 / gridSize)

      for (let x = -steps; x <= steps; x++) {
        for (let z = -steps; z <= steps; z++) {
          const worldX = center.x + x * gridSize
          const worldZ = center.z + z * gridSize
          const distance = Math.sqrt(x * x + z * z) * gridSize

          if (distance <= radius) {
            const elevation = terrain.getElevation(worldX, worldZ)
            const slope = terrain.getSlope(worldX, worldZ)

            // Calculate accumulation based on intensity and terrain
            const baseAccumulation = precipitation.intensity * precipitation.duration / 3600
            const slopeModifier = Math.max(0.1, 1 - slope * 0.5) // Less accumulation on steep slopes
            const finalAccumulation = baseAccumulation * slopeModifier

            accumulationMap.set(`${worldX},${worldZ}`, finalAccumulation)
          }
        }
      }

      return accumulationMap
    })

    const simulateRunoff = (
      accumulation: AccumulationMap,
      terrain: TerrainData
    ) => Effect.gen(function* () {
      const waterFlow: WaterFlow = {
        flowPaths: [],
        ponding: new Map(),
        drainage: new Map()
      }

      // Simple runoff simulation
      for (const [positionKey, amount] of accumulation) {
        const [x, z] = positionKey.split(',').map(Number)
        const elevation = terrain.getElevation(x, z)

        // Find steepest descent direction
        const neighbors = [
          { x: x + 1, z, elevation: terrain.getElevation(x + 1, z) },
          { x: x - 1, z, elevation: terrain.getElevation(x - 1, z) },
          { x, z: z + 1, elevation: terrain.getElevation(x, z + 1) },
          { x, z: z - 1, elevation: terrain.getElevation(x, z - 1) }
        ]

        const lowestNeighbor = neighbors.reduce((min, neighbor) =>
          neighbor.elevation < min.elevation ? neighbor : min
        )

        if (lowestNeighbor.elevation < elevation) {
          // Water flows to lower elevation
          const flowAmount = amount * 0.8 // 80% flows, 20% absorbed
          waterFlow.flowPaths.push({
            from: { x, z },
            to: { x: lowestNeighbor.x, z: lowestNeighbor.z },
            amount: flowAmount
          })
        } else {
          // Water ponds at this location
          waterFlow.ponding.set(positionKey, amount)
        }
      }

      return waterFlow
    })

    return {
      startPrecipitation,
      updatePrecipitation: (precipitationId, intensity) =>
        Ref.update(activePrecipitation, map => {
          const precip = map.get(precipitationId)
          if (precip) {
            map.set(precipitationId, { ...precip, intensity })
          }
          return map
        }),
      stopPrecipitation: (precipitationId) =>
        Ref.update(activePrecipitation, map => {
          map.delete(precipitationId)
          return map
        }),
      calculateGroundAccumulation,
      simulateRunoff
    } as const
  })
)
```

### Lightning and Thunder System

雷と雷鳴のシステムです。

```typescript
// Lightning System
export const LightningStrike = Schema.Struct({
  id: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  intensity: Schema.Number.pipe(Schema.between(0, 1)),
  duration: Schema.Number, // milliseconds
  branchingFactor: Schema.Number.pipe(Schema.between(0, 1)),
  groundStrike: Schema.Boolean,
  damage: Schema.Number,
  fireChance: Schema.Number.pipe(Schema.between(0, 1)),
  timestamp: Schema.DateTimeUtc
})

export type LightningStrike = Schema.Schema.Type<typeof LightningStrike>

interface LightningSystemInterface {
  readonly generateLightning: (
    thunderstormConditions: WeatherState,
    world: World
  ) => Effect.Effect<ReadonlyArray<LightningStrike>, LightningError>
  readonly calculateThunderDelay: (
    lightningPosition: { x: number; y: number; z: number },
    observerPosition: { x: number; y: number; z: number }
  ) => Effect.Effect<number, never>
  readonly simulateLightningPath: (
    startPosition: { x: number; y: number; z: number },
    targetPosition: { x: number; y: number; z: number }
  ) => Effect.Effect<ReadonlyArray<{ x: number; y: number; z: number }>, never>
  readonly applyLightningEffects: (
    strike: LightningStrike,
    world: World
  ) => Effect.Effect<World, LightningError>
}

const LightningSystem = Context.GenericTag<LightningSystemInterface>("@app/LightningSystem")

export const LightningSystemLive = Layer.effect(
  LightningSystem,
  Effect.gen(function* () {
    const generateLightning = (
      thunderstormConditions: WeatherState,
      world: World
    ) => Effect.gen(function* () {
      // 早期リターン: 雷雨でない場合は空配列を返す
      if (thunderstormConditions.condition !== "thunderstorm") {
        return []
      }

      const strikeCount = calculateLightningFrequency(thunderstormConditions)

      // 早期リターン: 雷の発生がない場合
      if (strikeCount === 0) {
        return []
      }

      const strikes = yield* Effect.forEach(
        Array.from({ length: strikeCount }, (_, i) => i),
        () => generateSingleLightningStrike(world, thunderstormConditions),
        { concurrency: "unbounded" }
      )

      return strikes
    })

    const generateSingleLightningStrike = (
      world: World,
      conditions: WeatherState
    ) => Effect.gen(function* () {
      // Find suitable strike location
      const cloudHeight = 120 + Math.random() * 50
      const strikeRange = 500 + Math.random() * 1000

      const targetX = (Math.random() - 0.5) * strikeRange
      const targetZ = (Math.random() - 0.5) * strikeRange
      const groundY = yield* getGroundLevel(targetX, targetZ)

      const strike: LightningStrike = {
        id: crypto.randomUUID(),
        position: {
          x: targetX,
          y: cloudHeight,
          z: targetZ
        },
        intensity: 0.7 + Math.random() * 0.3,
        duration: 100 + Math.random() * 200,
        branchingFactor: Math.random() * 0.5,
        groundStrike: Math.random() < 0.8, // 80% ground strikes
        damage: calculateLightningDamage(conditions.windSpeed),
        fireChance: calculateFireChance(conditions.humidity, conditions.precipitationIntensity),
        timestamp: new Date()
      }

      return strike
    })

    const calculateThunderDelay = (
      lightningPosition: { x: number; y: number; z: number },
      observerPosition: { x: number; y: number; z: number }
    ) => Effect.gen(function* () {
      const distance = Math.sqrt(
        Math.pow(lightningPosition.x - observerPosition.x, 2) +
        Math.pow(lightningPosition.y - observerPosition.y, 2) +
        Math.pow(lightningPosition.z - observerPosition.z, 2)
      )

      // Sound travels at ~343 m/s
      const soundSpeed = 343
      const delay = distance / soundSpeed

      return delay * 1000 // Convert to milliseconds
    })

    const simulateLightningPath = (
      startPosition: { x: number; y: number; z: number },
      targetPosition: { x: number; y: number; z: number }
    ) => Effect.gen(function* () {
      const path: { x: number; y: number; z: number }[] = []
      const steps = 20

      for (let i = 0; i <= steps; i++) {
        const progress = i / steps

        // Add natural zigzag pattern
        const deviation = (Math.random() - 0.5) * 5 * (1 - progress)

        const x = startPosition.x + (targetPosition.x - startPosition.x) * progress + deviation
        const y = startPosition.y + (targetPosition.y - startPosition.y) * progress
        const z = startPosition.z + (targetPosition.z - startPosition.z) * progress + deviation

        path.push({ x, y, z })
      }

      return path
    })

    const applyLightningEffects = (
      strike: LightningStrike,
      world: World
    ) => Effect.gen(function* () {
      let updatedWorld = world

      if (strike.groundStrike) {
        // Apply damage to entities in range
        const entities = yield* getEntitiesInRadius(
          world,
          strike.position,
          5 // 5 block damage radius
        )

        for (const entity of entities) {
          if (entity.type === "player" || entity.type === "mob") {
            const damage = calculateEntityLightningDamage(strike, entity)
            updatedWorld = yield* damageEntity(updatedWorld, entity.id, damage)
          }
        }

        // Start fires if conditions are right
        if (Math.random() < strike.fireChance) {
          const firePositions = yield* generateFireSpreadPositions(
            strike.position,
            world
          )

          for (const pos of firePositions) {
            updatedWorld = yield* setBlockAt(updatedWorld, pos, FireBlock)
          }
        }

        // Create lightning rod effects
        const nearbyLightningRods = yield* findNearbyLightningRods(
          world,
          strike.position,
          30 // 30 block detection radius
        )

        if (nearbyLightningRods.length > 0) {
          const closestRod = nearbyLightningRods[0]
          // Redirect lightning to rod and power nearby redstone
          updatedWorld = yield* activateRedstoneArea(
            updatedWorld,
            closestRod.position,
            15 // 15 power level
          )
        }
      }

      return updatedWorld
    })

    return {
      generateLightning,
      calculateThunderDelay,
      simulateLightningPath,
      applyLightningEffects
    } as const
  })
)
```

### Climate Simulation

長期的な気候シミュレーションです。

```typescript
// Climate System
export const ClimateZone = Schema.Literal(
  "tropical",
  "subtropical",
  "temperate",
  "continental",
  "polar",
  "alpine",
  "desert",
  "mediterranean"
)

export type ClimateZone = Schema.Schema.Type<typeof ClimateZone>

export const ClimateData = Schema.Struct({
  zone: ClimateZone,
  averageTemperature: Temperature,
  temperatureRange: Schema.Number,
  annualPrecipitation: Schema.Number,
  humidityRange: Schema.Struct({
    min: Humidity,
    max: Humidity
  }),
  seasonalVariation: Schema.Number.pipe(Schema.between(0, 1)),
  extremeWeatherFrequency: Schema.Number.pipe(Schema.between(0, 1))
})

export type ClimateData = Schema.Schema.Type<typeof ClimateData>

interface ClimateSimulationInterface {
  readonly simulateLongTermClimate: (
    region: RegionalWeather,
    years: number
  ) => Effect.Effect<Stream.Stream<ClimateData, never>, ClimateSimulationError>
  readonly calculateClimateChange: (
    baseClimate: ClimateData,
    timeElapsed: number,
    factors: ClimateForcingFactors
  ) => Effect.Effect<ClimateData, ClimateSimulationError>
  readonly generateSeasonalCycle: (
    climate: ClimateData,
    year: number
  ) => Effect.Effect<ReadonlyArray<SeasonalModifiers>, never>
  readonly predictExtremeEvents: (
    climate: ClimateData,
    timeframe: number
  ) => Effect.Effect<
    ReadonlyArray<{ eventType: string; probability: number; severity: number }>,
    never
  >
}

const ClimateSimulation = Context.GenericTag<ClimateSimulationInterface>("@app/ClimateSimulation")

// Weather Front System
export const WeatherFront = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("cold", "warm", "occluded", "stationary"),
  position: Schema.Struct({
    centerX: Schema.Number,
    centerZ: Schema.Number
  }),
  extent: Schema.Struct({
    width: Schema.Number,
    length: Schema.Number
  }),
  movementVector: Schema.Struct({
    speedX: Schema.Number,
    speedZ: Schema.Number
  }),
  intensity: Schema.Number.pipe(Schema.between(0, 1)),
  associatedWeather: WeatherCondition,
  duration: Schema.Number,
  createdAt: Schema.DateTimeUtc
})

export type WeatherFront = Schema.Schema.Type<typeof WeatherFront>

interface WeatherFrontSystemInterface {
  readonly createFront: (
    frontType: WeatherFront["type"],
    position: { x: number; z: number },
    intensity: number
  ) => Effect.Effect<WeatherFront, never>
  readonly moveFronts: (
    fronts: ReadonlyArray<WeatherFront>,
    deltaTime: number
  ) => Effect.Effect<ReadonlyArray<WeatherFront>, never>
  readonly calculateFrontInfluence: (
    front: WeatherFront,
    position: { x: number; z: number }
  ) => Effect.Effect<WeatherState, never>
  readonly detectFrontCollisions: (
    fronts: ReadonlyArray<WeatherFront>
  ) => Effect.Effect<
    ReadonlyArray<{ frontA: string; frontB: string; collisionType: string }>,
    never
  >
}

const WeatherFrontSystem = Context.GenericTag<WeatherFrontSystemInterface>("@app/WeatherFrontSystem")
```

### Weather Impact System

天候がゲームプレイに与える影響を管理するシステムです。

```typescript
// Weather Impact on Gameplay
interface WeatherImpactSystemInterface {
  readonly calculateVisibilityEffects: (
    weather: WeatherState,
    player: Player
  ) => Effect.Effect<VisibilityModifiers, never>
  readonly applyMovementEffects: (
    weather: WeatherState,
    entity: Entity
  ) => Effect.Effect<MovementModifiers, never>
  readonly calculateCropGrowthModifiers: (
    weather: WeatherState,
    cropType: string
  ) => Effect.Effect<GrowthModifiers, never>
  readonly simulateWeatherDamage: (
    weather: WeatherState,
    structures: ReadonlyArray<Structure>
  ) => Effect.Effect<ReadonlyArray<DamageReport>, never>
  readonly updateBiomeTransitions: (
    weather: WeatherState,
    biome: Biome,
    duration: number
  ) => Effect.Effect<BiomeTransition, never>
}

const WeatherImpactSystem = Context.GenericTag<WeatherImpactSystemInterface>("@app/WeatherImpactSystem")

export const WeatherImpactSystemLive = Layer.effect(
  WeatherImpactSystem,
  Effect.gen(function* () {
    const calculateVisibilityEffects = (
      weather: WeatherState,
      player: Player
    ) => Effect.gen(function* () {
      let viewDistance = player.settings.renderDistance

      // 天候による視界への影響を計算
      const weatherMultiplier = Match.value(weather.condition).pipe(
        Match.when("heavy_rain", () => 0.7),
        Match.when("thunderstorm", () => 0.5),
        Match.when("heavy_snow", () => 0.3),
        Match.when("blizzard", () => 0.3),
        Match.when("fog", () => 0.2),
        Match.when("sandstorm", () => 0.1),
        Match.orElse(() => 1.0)
      )

      // 追加の修正値
      const humidityEffect = 1 - (weather.humidity / 100) * 0.2
      const precipitationEffect = 1 - weather.precipitationIntensity * 0.3

      viewDistance *= weatherMultiplier * humidityEffect * precipitationEffect

      return {
        renderDistance: Math.max(viewDistance, 2), // 最低2チャンク
        fogDensity: calculateFogDensity(weather),
        tintColor: calculateWeatherTint(weather),
        particleOpacity: calculateParticleOpacity(weather)
      }
    })

    const applyMovementEffects = (
      weather: WeatherState,
      entity: Entity
    ) => Effect.gen(function* () {
      let speedMultiplier = 1.0
      let slipperyness = 0.0
      let jumpModifier = 1.0

      // Temperature effects
      if (weather.temperature < -10) {
        speedMultiplier *= 0.8 // Slower movement in extreme cold
      }

      // Wind effects
      if (weather.windSpeed > 10) {
        const windResistance = Math.min(0.3, weather.windSpeed / 50)
        speedMultiplier *= (1 - windResistance)
      }

      // Precipitation effects
      if (weather.precipitationIntensity > 0.3) {
        speedMultiplier *= 0.9
        slipperyness += 0.1
      }

      // Snow accumulation
      if (weather.condition === "heavy_snow" || weather.condition === "blizzard") {
        speedMultiplier *= 0.7
        jumpModifier *= 0.8
      }

      // Fog disorientation
      if (weather.condition === "fog") {
        // Reduce movement precision in fog
        const disorientationFactor = 0.1
        speedMultiplier *= (1 - disorientationFactor)
      }

      return {
        speedMultiplier: Math.max(speedMultiplier, 0.1),
        slipperyness,
        jumpModifier,
        staminaDrain: calculateStaminaDrain(weather)
      }
    })

    const calculateCropGrowthModifiers = (
      weather: WeatherState,
      cropType: string
    ) => Effect.gen(function* () {
      const cropProfile = getCropWeatherProfile(cropType)

      // Temperature effects
      let temperatureModifier = 1.0
      if (weather.temperature < cropProfile.minTemperature ||
          weather.temperature > cropProfile.maxTemperature) {
        temperatureModifier = 0.1 // Severe growth penalty
      } else {
        const optimalRange = cropProfile.optimalTemperatureRange
        const distanceFromOptimal = Math.abs(weather.temperature - optimalRange.center)
        temperatureModifier = Math.max(0.1, 1 - distanceFromOptimal / optimalRange.tolerance)
      }

      // Moisture effects
      let moistureModifier = 1.0
      if (weather.precipitationIntensity < cropProfile.minMoisture) {
        moistureModifier = 0.3 // Drought stress
      } else if (weather.precipitationIntensity > cropProfile.maxMoisture) {
        moistureModifier = 0.5 // Waterlogging
      } else {
        moistureModifier = 1.2 // Optimal moisture boosts growth
      }

      // Light effects (cloudy weather reduces photosynthesis)
      const lightModifier = 1 - (weather.cloudCoverage / 100) * 0.3

      return {
        growthRate: temperatureModifier * moistureModifier * lightModifier,
        diseaseResistance: calculateDiseaseResistance(weather, cropProfile),
        yieldModifier: calculateYieldModifier(weather, cropProfile)
      }
    })

    return {
      calculateVisibilityEffects,
      applyMovementEffects,
      calculateCropGrowthModifiers,
      simulateWeatherDamage: (weather, structures) =>
        simulateWeatherDamageImpl(weather, structures),
      updateBiomeTransitions: (weather, biome, duration) =>
        updateBiomeTransitionsImpl(weather, biome, duration)
    } as const
  })
)
```

## Layer構成

```typescript
// Weather System Layer
export const WeatherSystemLayer = Layer.mergeAll(
  WeatherGeneratorLive,
  PrecipitationSystemLive,
  LightningSystemLive,
  Layer.effect(ClimateSimulation, ClimateSimulationLive),
  Layer.effect(WeatherFrontSystem, WeatherFrontSystemLive),
  WeatherImpactSystemLive
).pipe(
  Layer.provide(ParticleSystemLayer),
  Layer.provide(WorldSystemLayer),
  Layer.provide(EventBusLayer)
)
```

## 使用例

```typescript
// Weather System の使用例
const exampleWeatherSimulation = Effect.gen(function* () {
  const generator = yield* WeatherGenerator
  const precipitationSystem = yield* PrecipitationSystem
  const lightningSystem = yield* LightningSystem

  // リージョナル天候の設定
  const region: RegionalWeather = {
    regionId: "plains_001",
    biome: "plains",
    weatherState: {
      condition: "partly_cloudy",
      temperature: 20 as Temperature,
      humidity: 60 as Humidity,
      pressure: 1013 as Pressure,
      windSpeed: 5 as WindSpeed,
      windDirection: 270,
      cloudCoverage: 30 as CloudCoverage,
      precipitationIntensity: 0,
      visibility: 1000,
      timestamp: new Date()
    },
    microclimate: {
      temperature_modifier: 0,
      humidity_modifier: 0,
      precipitation_modifier: 0
    },
    elevation: 64,
    latitude: 45,
    longitude: 0
  }

  // 24時間の天候パターン生成
  const weatherStream = yield* generator.generateWeatherPattern(region, 24)

  // 天候変化の監視と対応
  yield* Stream.runForeach(weatherStream, (weather) =>
    Effect.gen(function* () {
      console.log(`Weather update: ${weather.condition} at ${weather.timestamp}`)

      // 雷雨の場合は雷システムを起動
      if (weather.condition === "thunderstorm") {
        const world = yield* WorldSystem
        const lightningStrikes = yield* lightningSystem.generateLightning(weather, world)

        for (const strike of lightningStrikes) {
          console.log(`Lightning strike at ${JSON.stringify(strike.position)}`)
          yield* lightningSystem.applyLightningEffects(strike, world)
        }
      }

      // 降水の場合は降水システムを起動
      if (weather.precipitationIntensity > 0.3) {
        const precipitation: Precipitation = {
          type: weather.temperature < 0 ? "snow" : "rain",
          intensity: weather.precipitationIntensity,
          dropletSize: 2,
          fallVelocity: 10,
          coverage: weather.cloudCoverage / 100,
          duration: 1800, // 30 minutes
          startTime: weather.timestamp,
          affectedArea: {
            center: { x: 0, z: 0 },
            radius: 500
          }
        }

        const world = yield* WorldSystem
        yield* precipitationSystem.startPrecipitation(precipitation, world)
      }
    })
  )
})
```

## パフォーマンス最適化

### 空間パーティショニング

```typescript
// 効率的な天候エリア管理
export const createWeatherGrid = (worldSize: number, gridSize: number) =>
  Effect.gen(function* () {
    const grid = new Map<string, WeatherCell>()
    const cellCount = Math.ceil(worldSize / gridSize)

    for (let x = 0; x < cellCount; x++) {
      for (let z = 0; z < cellCount; z++) {
        const cellId = `${x},${z}`
        grid.set(cellId, {
          id: cellId,
          bounds: {
            minX: x * gridSize,
            maxX: (x + 1) * gridSize,
            minZ: z * gridSize,
            maxZ: (z + 1) * gridSize
          },
          weather: createDefaultWeather(),
          lastUpdate: 0
        })
      }
    }

    return {
      grid,
      getCellForPosition: (x: number, z: number) => {
        const cellX = Math.floor(x / gridSize)
        const cellZ = Math.floor(z / gridSize)
        return grid.get(`${cellX},${cellZ}`)
      },
      updateCell: (cellId: string, weather: WeatherState) => {
        const cell = grid.get(cellId)
        if (cell) {
          grid.set(cellId, { ...cell, weather, lastUpdate: Date.now() })
        }
      }
    }
  })
```

### レベルオブディテール

```typescript
// 距離に応じた天候詳細度調整
export const adaptWeatherDetail = (
  playerPosition: { x: number; z: number },
  weatherCells: ReadonlyArray<WeatherCell>
) => Effect.gen(function* () {
  const adaptedCells = weatherCells.map(cell => {
    const distance = calculateDistance(playerPosition, cell.bounds)

    if (distance < 100) {
      // 高詳細度 - フル天候シミュレーション
      return {
        ...cell,
        detailLevel: "high" as const,
        updateFrequency: 50 // 50ms
      }
    } else if (distance < 500) {
      // 中詳細度 - 基本的な天候効果のみ
      return {
        ...cell,
        detailLevel: "medium" as const,
        updateFrequency: 200 // 200ms
      }
    } else {
      // 低詳細度 - 静的な天候状態
      return {
        ...cell,
        detailLevel: "low" as const,
        updateFrequency: 1000 // 1s
      }
    }
  })

  return adaptedCells
})
```

## テスト戦略

```typescript
describe("Weather System", () => {
  const TestWeatherLayer = Layer.mergeAll(
    WeatherSystemLayer,
    TestWorldLayer,
    TestParticleSystemLayer
  )

  it("should generate realistic weather transitions", () =>
    Effect.gen(function* () {
      const generator = yield* WeatherGenerator

      const region = createTestRegion("temperate")
      const weatherStream = yield* generator.generateWeatherPattern(region, 48)

      const states = yield* Stream.runCollect(weatherStream)

      // Verify temperature doesn't change too rapidly
      for (let i = 1; i < states.length; i++) {
        const tempChange = Math.abs(states[i].temperature - states[i-1].temperature)
        expect(tempChange).toBeLessThan(10) // Max 10°C change per hour
      }
    }).pipe(
      Effect.provide(TestWeatherLayer),
      Effect.runPromise
    ))

  it("should apply correct lightning effects", () =>
    Effect.gen(function* () {
      const lightningSystem = yield* LightningSystem
      const world = createTestWorld()

      const strike: LightningStrike = {
        id: "test-strike",
        position: { x: 0, y: 100, z: 0 },
        intensity: 1,
        duration: 200,
        branchingFactor: 0.3,
        groundStrike: true,
        damage: 20,
        fireChance: 0.1,
        timestamp: new Date()
      }

      const updatedWorld = yield* lightningSystem.applyLightningEffects(strike, world)

      // Verify effects were applied
      const entities = getEntitiesAt(updatedWorld, strike.position, 5)
      expect(entities.some(e => e.health < e.maxHealth)).toBe(true)
    }).pipe(
      Effect.provide(TestWeatherLayer),
      Effect.runPromise
    ))
})
```

このWeather Systemは、リアルな気象現象をシミュレートし、ゲームプレイに深みのある環境効果を提供します。Effect-TSのStream機能を活用することで、連続的で動的な天候変化を効率的に実現し、プレイヤーに没入感のある体験を届けます。