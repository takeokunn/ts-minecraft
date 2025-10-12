import { Context, Effect, HashMap, Layer, Option, Stream, SubscriptionRef, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'

import type { Camera } from '../aggregate/camera/camera'
import type { CameraId, CameraSnapshot } from '../types'
import { cameraToSnapshot } from './helpers'

interface CameraReadModelState {
  readonly snapshots: HashMap.HashMap<CameraId, CameraSnapshot>
}

const makeInitialState = (): CameraReadModelState => ({
  snapshots: HashMap.empty<CameraId, CameraSnapshot>(),
})

export interface CameraReadModel {
  readonly upsert: (camera: Camera) => Effect.Effect<void>
  readonly remove: (cameraId: CameraId) => Effect.Effect<void>
  readonly getSnapshot: (cameraId: CameraId) => Effect.Effect<Option.Option<CameraSnapshot>>
  readonly getAllSnapshots: Effect.Effect<ReadonlyArray.ReadonlyArray<CameraSnapshot>>
  readonly snapshotStream: Stream.Stream<ReadonlyArray.ReadonlyArray<CameraSnapshot>>
}

export const CameraReadModel = Context.GenericTag<CameraReadModel>('@minecraft/domain/camera/CQRS/ReadModel')

export const CameraReadModelLive = Layer.effect(
  CameraReadModel,
  Effect.gen(function* () {
    const subscription = yield* SubscriptionRef.make<CameraReadModelState>(makeInitialState())

    const upsert: CameraReadModel['upsert'] = (camera) =>
      pipe(
        SubscriptionRef.update(subscription, (state) => ({
          snapshots: HashMap.set(state.snapshots, camera.id, cameraToSnapshot(camera)),
        }))
      )

    const remove: CameraReadModel['remove'] = (cameraId) =>
      SubscriptionRef.update(subscription, (state) => ({
        snapshots: HashMap.remove(state.snapshots, cameraId),
      }))

    const getSnapshot: CameraReadModel['getSnapshot'] = (cameraId) =>
      SubscriptionRef.get(subscription).pipe(Effect.map((state) => HashMap.get(state.snapshots, cameraId)))

    const getAllSnapshots: CameraReadModel['getAllSnapshots'] = SubscriptionRef.get(subscription).pipe(
      Effect.map((state) => ReadonlyArray.fromIterable(HashMap.values(state.snapshots)))
    )

    const snapshotStream: CameraReadModel['snapshotStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => ReadonlyArray.fromIterable(HashMap.values(state.snapshots)))
    )

    return CameraReadModel.of({
      upsert,
      remove,
      getSnapshot,
      getAllSnapshots,
      snapshotStream,
    })
  })
)
