import { Effect, Option, Ref } from 'effect'

// Parked vehicles: boats and minecarts as persistent world objects. Mounting
// removes the parked instance and enters the movement modality; dismounting
// parks a new instance at the rider's position (the old consume/refund model
// made vehicles vanish from the world while not ridden).
export type ParkedVehicleKind = 'boat' | 'minecart'

export type ParkedVehicle = {
  readonly id: string
  readonly kind: ParkedVehicleKind
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly yaw: number
}

const distanceSquared = (
  a: { readonly x: number; readonly y: number; readonly z: number },
  b: { readonly x: number; readonly y: number; readonly z: number },
): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export class ParkedVehicleService extends Effect.Service<ParkedVehicleService>()(
  '@minecraft/application/ParkedVehicleService',
  {
    effect: Effect.gen(function* () {
      const vehiclesRef = yield* Ref.make<ReadonlyArray<ParkedVehicle>>([])
      const nextIdRef = yield* Ref.make(0)

      return {
        park: (
          kind: ParkedVehicleKind,
          position: { readonly x: number; readonly y: number; readonly z: number },
          yaw: number = 0,
        ): Effect.Effect<ParkedVehicle, never> =>
          Effect.gen(function* () {
            const nextId = yield* Ref.updateAndGet(nextIdRef, (value) => value + 1)
            const vehicle: ParkedVehicle = { id: `parked-vehicle-${nextId}`, kind, position, yaw }
            yield* Ref.update(vehiclesRef, (vehicles) => [...vehicles, vehicle])
            return vehicle
          }),

        getAll: (): Effect.Effect<ReadonlyArray<ParkedVehicle>, never> => Ref.get(vehiclesRef),

        // Claim (remove and return) the nearest parked vehicle within reach of
        // `position` — mounting and pickup both go through this so two callers
        // can never claim the same vehicle twice.
        claimNearest: (
          position: { readonly x: number; readonly y: number; readonly z: number },
          maxDistance: number,
        ): Effect.Effect<Option.Option<ParkedVehicle>, never> =>
          Ref.modify(vehiclesRef, (vehicles) => {
            let best: ParkedVehicle | null = null
            let bestDistSq = maxDistance * maxDistance
            for (const vehicle of vehicles) {
              const distSq = distanceSquared(vehicle.position, position)
              if (distSq <= bestDistSq) {
                best = vehicle
                bestDistSq = distSq
              }
            }
            if (best === null) return [Option.none<ParkedVehicle>(), vehicles]
            const claimed = best
            return [Option.some(claimed), vehicles.filter((vehicle) => vehicle.id !== claimed.id)]
          }),

        serialize: (): Effect.Effect<ReadonlyArray<ParkedVehicle>, never> => Ref.get(vehiclesRef),

        restore: (vehicles: ReadonlyArray<ParkedVehicle>): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(vehiclesRef, vehicles)
            // Continue ids past the restored set so new parks never collide.
            const maxId = vehicles.reduce((max, vehicle) => {
              const n = Number(vehicle.id.split('-').at(-1))
              return Number.isFinite(n) ? Math.max(max, n) : max
            }, 0)
            yield* Ref.set(nextIdRef, maxId)
          }),

        reset: (): Effect.Effect<void, never> =>
          Effect.all([Ref.set(vehiclesRef, []), Ref.set(nextIdRef, 0)]).pipe(Effect.asVoid),
      }
    }),
  },
) {}
