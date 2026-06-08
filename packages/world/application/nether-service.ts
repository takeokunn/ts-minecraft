import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { Dimension } from '../domain/nether/nether-travel'

export type NetherServiceImpl = {
  readonly getDimension: () => Effect.Effect<Dimension>
  readonly setDimension: (dim: Dimension) => Effect.Effect<void>
  readonly registerPortal: (pos: Position, dim: Dimension) => Effect.Effect<void>
  readonly getPortals: (dim: Dimension) => Effect.Effect<ReadonlyArray<Position>>
}

type NetherState = {
  readonly dimension: Dimension
  readonly portals: HashMap.HashMap<Dimension, ReadonlyArray<Position>>
}

const INITIAL_STATE: NetherState = {
  dimension: 'overworld',
  portals: HashMap.fromIterable<Dimension, ReadonlyArray<Position>>([['overworld', []], ['nether', []], ['end', []]]),
}

export class NetherService extends Effect.Service<NetherService>()('@ts-minecraft/nether/NetherService', {
  effect: Effect.gen(function* () {
    const stateRef = yield* Ref.make(INITIAL_STATE)

    const getDimension = (): Effect.Effect<Dimension> =>
      Ref.get(stateRef).pipe(Effect.map((s) => s.dimension))

    const setDimension = (dim: Dimension): Effect.Effect<void> =>
      Ref.update(stateRef, (s) => ({ ...s, dimension: dim }))

    const registerPortal = (pos: Position, dim: Dimension): Effect.Effect<void> =>
      Ref.update(stateRef, (s) => {
        const list = Option.getOrElse(HashMap.get(s.portals, dim), () => [] as ReadonlyArray<Position>)
        const already = list.some((p) => p.x === pos.x && p.y === pos.y && p.z === pos.z)
        if (already) return s
        return { ...s, portals: HashMap.set(s.portals, dim, Arr.append(list, pos)) }
      })

    const getPortals = (dim: Dimension): Effect.Effect<ReadonlyArray<Position>> =>
      Ref.get(stateRef).pipe(
        Effect.map((s) => Option.getOrElse(HashMap.get(s.portals, dim), () => [] as ReadonlyArray<Position>)),
      )

    return { getDimension, setDimension, registerPortal, getPortals } satisfies NetherServiceImpl
  }),
}) {}
