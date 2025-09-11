import * as S from '@effect/schema/Schema'
import { Brand, Data } from 'effect'
import { ChunkX, ChunkZ } from '../common'

// Branded types for type safety
export type WorldX = number & Brand.Brand<'WorldX'>
export type WorldY = number & Brand.Brand<'WorldY'>
export type WorldZ = number & Brand.Brand<'WorldZ'>

export const WorldX = Brand.refined<WorldX>(
  (n): n is number => Number.isFinite(n),
  (n) => Brand.error(`Invalid WorldX: ${n}`),
)

export const WorldY = Brand.refined<WorldY>(
  (n): n is number => Number.isFinite(n) && n >= 0 && n <= 255,
  (n) => Brand.error(`Invalid WorldY: ${n} (must be between 0 and 255)`),
)

export const WorldZ = Brand.refined<WorldZ>(
  (n): n is number => Number.isFinite(n),
  (n) => Brand.error(`Invalid WorldZ: ${n}`),
)

// Schema definitions
export const WorldXSchema = S.Number.pipe(
  S.finite(),
  S.brand('WorldX'),
)

export const WorldYSchema = S.Number.pipe(
  S.finite(),
  S.between(0, 255),
  S.brand('WorldY'),
)

export const WorldZSchema = S.Number.pipe(
  S.finite(),
  S.brand('WorldZ'),
)

// Position as a Data.struct for immutability
export const PositionSchema = S.Struct({
  x: WorldXSchema,
  y: WorldYSchema,
  z: WorldZSchema,
})

export type Position = Data.Struct<{
  readonly x: WorldX
  readonly y: WorldY
  readonly z: WorldZ
}>

export const Position = Data.struct<Position>()

export const makePosition = (x: number, y: number, z: number): Position =>
  Position({
    x: WorldX(x),
    y: WorldY(y),
    z: WorldZ(z),
  })

// Pure functions for Position operations
export const translate = (dx: number, dy: number, dz: number) =>
  (pos: Position): Position =>
    makePosition(pos.x + dx, pos.y + dy, pos.z + dz)

export const distance = (other: Position) =>
  (pos: Position): number => {
    const dx = pos.x - other.x
    const dy = pos.y - other.y
    const dz = pos.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

export const toChunkCoords = (pos: Position): ChunkCoordinates =>
  makeChunkCoordinates(
    Math.floor(pos.x / 16),
    Math.floor(pos.z / 16),
  )


export const ChunkCoordinatesSchema = S.Struct({
  x: S.Int.pipe(S.brand('ChunkX')),
  z: S.Int.pipe(S.brand('ChunkZ')),
})

export type ChunkCoordinates = Data.Struct<{
  readonly x: ChunkX
  readonly z: ChunkZ
}>

export const ChunkCoordinates = Data.struct<ChunkCoordinates>()

export const makeChunkCoordinates = (x: number, z: number): ChunkCoordinates =>
  ChunkCoordinates({
    x: x as ChunkX,
    z: z as ChunkZ,
  })

export const toKey = (coords: ChunkCoordinates): string =>
  `${coords.x},${coords.z}`

export const fromKey = (key: string): ChunkCoordinates => {
  const parts = key.split(',')
  const x = parts[0] ? Number(parts[0]) : 0
  const z = parts[1] ? Number(parts[1]) : 0
  return makeChunkCoordinates(x, z)
}

// Velocity with branded types
export type Velocity = number & Brand.Brand<'Velocity'>

export const Velocity = Brand.refined<Velocity>(
  (n): n is number => Number.isFinite(n) && Math.abs(n) <= 100,
  (n) => Brand.error(`Invalid Velocity: ${n} (must be between -100 and 100)`),
)

export const Velocity3DSchema = S.Struct({
  dx: S.Number.pipe(S.finite(), S.clamp(-100, 100), S.brand('Velocity')),
  dy: S.Number.pipe(S.finite(), S.clamp(-100, 100), S.brand('Velocity')),
  dz: S.Number.pipe(S.finite(), S.clamp(-100, 100), S.brand('Velocity')),
})

export type Velocity3D = Data.Struct<{
  readonly dx: Velocity
  readonly dy: Velocity
  readonly dz: Velocity
}>

export const Velocity3D = Data.struct<Velocity3D>()

export const makeVelocity3D = (dx: number, dy: number, dz: number): Velocity3D =>
  Velocity3D({
    dx: Velocity(Math.max(-100, Math.min(100, dx))),
    dy: Velocity(Math.max(-100, Math.min(100, dy))),
    dz: Velocity(Math.max(-100, Math.min(100, dz))),
  })

export const zeroVelocity = (): Velocity3D =>
  Velocity3D({
    dx: Velocity(0),
    dy: Velocity(0),
    dz: Velocity(0),
  })

// Pure functions for Velocity3D operations
export const magnitude = (vel: Velocity3D): number =>
  Math.sqrt(vel.dx * vel.dx + vel.dy * vel.dy + vel.dz * vel.dz)

export const normalize = (vel: Velocity3D): Velocity3D => {
  const mag = magnitude(vel)
  if (mag === 0) return zeroVelocity()
  return makeVelocity3D(vel.dx / mag, vel.dy / mag, vel.dz / mag)
}

export const scale = (factor: number) =>
  (vel: Velocity3D): Velocity3D =>
    makeVelocity3D(
      vel.dx * factor,
      vel.dy * factor,
      vel.dz * factor,
    )

export const addVelocity = (other: Velocity3D) =>
  (vel: Velocity3D): Velocity3D =>
    makeVelocity3D(
      vel.dx + other.dx,
      vel.dy + other.dy,
      vel.dz + other.dz,
    )