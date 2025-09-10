import * as S from 'effect/Schema'
import { Brand, Data } from 'effect'

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

// Position as a Data class for immutability
export class Position extends Data.Class<{
  readonly x: WorldX
  readonly y: WorldY
  readonly z: WorldZ
}> {
  static readonly schema = S.Struct({
    x: WorldXSchema,
    y: WorldYSchema,
    z: WorldZSchema,
  })

  static readonly make = (x: number, y: number, z: number) =>
    new Position({
      x: WorldX(x),
      y: WorldY(y),
      z: WorldZ(z),
    })

  translate(dx: number, dy: number, dz: number): Position {
    return Position.make(this.x + dx, this.y + dy, this.z + dz)
  }

  distance(other: Position): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const dz = this.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  toChunkCoords(): ChunkCoordinates {
    return ChunkCoordinates.make(
      Math.floor(this.x / 16),
      Math.floor(this.z / 16),
    )
  }
}

// Chunk coordinates
export type ChunkX = number & Brand.Brand<'ChunkX'>
export type ChunkZ = number & Brand.Brand<'ChunkZ'>

export const ChunkX = Brand.refined<ChunkX>(
  (n): n is number => Number.isInteger(n),
  (n) => Brand.error(`Invalid ChunkX: ${n}`),
)

export const ChunkZ = Brand.refined<ChunkZ>(
  (n): n is number => Number.isInteger(n),
  (n) => Brand.error(`Invalid ChunkZ: ${n}`),
)

export class ChunkCoordinates extends Data.Class<{
  readonly x: ChunkX
  readonly z: ChunkZ
}> {
  static readonly schema = S.Struct({
    x: S.Int.pipe(S.brand('ChunkX')),
    z: S.Int.pipe(S.brand('ChunkZ')),
  })

  static readonly make = (x: number, z: number) =>
    new ChunkCoordinates({
      x: ChunkX(x),
      z: ChunkZ(z),
    })

  toKey(): string {
    return `${this.x},${this.z}`
  }

  static fromKey(key: string): ChunkCoordinates {
    const parts = key.split(',')
    const x = parts[0] ? Number(parts[0]) : 0
    const z = parts[1] ? Number(parts[1]) : 0
    return ChunkCoordinates.make(x, z)
  }
}

// Velocity with branded types
export type Velocity = number & Brand.Brand<'Velocity'>

export const Velocity = Brand.refined<Velocity>(
  (n): n is number => Number.isFinite(n) && Math.abs(n) <= 100,
  (n) => Brand.error(`Invalid Velocity: ${n} (must be between -100 and 100)`),
)

export class Velocity3D extends Data.Class<{
  readonly dx: Velocity
  readonly dy: Velocity
  readonly dz: Velocity
}> {
  static readonly schema = S.Struct({
    dx: S.Number.pipe(S.finite(), S.clamp(-100, 100), S.brand('Velocity')),
    dy: S.Number.pipe(S.finite(), S.clamp(-100, 100), S.brand('Velocity')),
    dz: S.Number.pipe(S.finite(), S.clamp(-100, 100), S.brand('Velocity')),
  })

  static readonly zero = () =>
    new Velocity3D({
      dx: Velocity(0),
      dy: Velocity(0),
      dz: Velocity(0),
    })

  static readonly make = (dx: number, dy: number, dz: number) =>
    new Velocity3D({
      dx: Velocity(Math.max(-100, Math.min(100, dx))),
      dy: Velocity(Math.max(-100, Math.min(100, dy))),
      dz: Velocity(Math.max(-100, Math.min(100, dz))),
    })

  magnitude(): number {
    return Math.sqrt(this.dx * this.dx + this.dy * this.dy + this.dz * this.dz)
  }

  normalize(): Velocity3D {
    const mag = this.magnitude()
    if (mag === 0) return Velocity3D.zero()
    return Velocity3D.make(this.dx / mag, this.dy / mag, this.dz / mag)
  }

  scale(factor: number): Velocity3D {
    return Velocity3D.make(
      this.dx * factor,
      this.dy * factor,
      this.dz * factor,
    )
  }

  add(other: Velocity3D): Velocity3D {
    return Velocity3D.make(
      this.dx + other.dx,
      this.dy + other.dy,
      this.dz + other.dz,
    )
  }
}