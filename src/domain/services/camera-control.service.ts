import { Effect } from 'effect'
import { ReadonlyArray } from 'effect/ReadonlyArray'
import { clampPitch } from '@domain/services/camera-logic'
import { DomainQueryService } from '@domain/queries/domain-queries'
import { WorldRepositoryPort } from '@domain/ports/world-repository.port'
import { InputPort } from '@domain/ports/input.port'
import { toFloat } from '@domain/value-objects/common'
import { CameraState } from '@domain/entities/components'

const MOUSE_SENSITIVITY = 0.002

export const cameraControlSystem = Effect.gen(function* (_) {
  const world = yield* _(WorldRepositoryPort)
  const inputManager = yield* _(InputPort)
  const mouseDelta = yield* _(inputManager.getMouseState())

  yield* _(
    Effect.when(
      () => mouseDelta.dx !== 0 || mouseDelta.dy !== 0,
      Effect.gen(function* (_) {
        const domainQuery = yield* _(DomainQueryService)
        const { entities, components } = yield* _(domainQuery.executePlayerQuery())
        const { cameraState } = components

        const deltaPitch = -mouseDelta.dy * MOUSE_SENSITIVITY
        const deltaYaw = -mouseDelta.dx * MOUSE_SENSITIVITY

        const players = ReadonlyArray.zip(entities, cameraState)

        yield* _(
          Effect.forEach(
            players,
            ([entityId, currentCameraState]) => {
              const newPitch = clampPitch(toFloat(currentCameraState.pitch + deltaPitch))
              const newYaw = toFloat(currentCameraState.yaw + deltaYaw)
              const newCameraState: CameraState = { pitch: newPitch, yaw: newYaw }
              return world.updateComponent(entityId, 'cameraState', newCameraState)
            },
            { concurrency: 'inherit', discard: true },
          ),
        )
      }),
    ),
  )
})
