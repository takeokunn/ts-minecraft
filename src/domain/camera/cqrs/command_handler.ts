import { Context, Effect, Layer, Match, Option } from 'effect'

import type {
  CameraCommand,
  SwitchCameraModeCommand,
  UpdateCameraPositionCommand,
  UpdateCameraRotationCommand,
  UpdateCameraSettingsCommand,
  CameraSnapshot,
} from '../types'
import {
  createCameraError,
  type CameraError,
  type PositionError,
  type RotationError,
  type SettingsError,
} from '../types'
import type { Camera } from '../aggregate/camera/camera'
import { CameraOps } from '../aggregate/camera/camera'
import {
  CameraStateRepository,
  type CameraStateRepository as CameraStateRepositoryService,
  type RepositoryError,
} from '../repository/camera_state'
import { ViewModeFactory, ViewModeDefaultSettings, createCameraRotation, createPosition3D, ViewModeError } from '../value_object'
import type { ViewMode, CameraSettings } from '../value_object'
import type { CameraId } from '../types'
import { cameraToSnapshot } from './helpers'
import { SettingsFactory } from '../value_object/camera_settings/operations'

export type CameraCommandHandlerError =
  | CameraError
  | PositionError
  | RotationError
  | ViewModeError
  | SettingsError
  | RepositoryError

export interface CameraCommandHandler {
  readonly handle: (command: CameraCommand) => Effect.Effect<CameraSnapshot, CameraCommandHandlerError>
}

export const CameraCommandHandler = Context.GenericTag<CameraCommandHandler>(
  '@minecraft/domain/camera/CQRS/CommandHandler'
)

const ensureCameraExists = (
  repository: CameraStateRepositoryService,
  cameraId: CameraId
): Effect.Effect<Camera, CameraCommandHandlerError> =>
  repository.findById(cameraId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(createCameraError.invalidParameter('cameraId', cameraId, '既存のCamera ID')), // CameraError
        onSome: Effect.succeed,
      })
    )
  )

const toViewMode = (mode: string): Effect.Effect<ViewMode, ViewModeError> => {
  switch (mode) {
    case 'first-person':
      return ViewModeFactory.createFirstPerson(ViewModeDefaultSettings.firstPerson())
    case 'third-person': {
      const thirdPerson = ViewModeDefaultSettings.thirdPerson()
      return ViewModeFactory.createThirdPerson(thirdPerson, thirdPerson.distance)
    }
    case 'spectator':
      return ViewModeFactory.createSpectator(ViewModeDefaultSettings.spectator())
    case 'cinematic':
      return ViewModeFactory.createCinematic(ViewModeDefaultSettings.cinematic(), {
        keyframes: [],
        duration: 5,
        loop: false,
      })
    default:
      return Effect.fail(ViewModeError.InvalidMode({ mode }))
  }
}

const buildSettingsUpdate = (
  command: UpdateCameraSettingsCommand
): Effect.Effect<Partial<CameraSettings>, SettingsError> =>
  Effect.gen(function* () {
    const updates: Partial<CameraSettings> = {}

    if (command.fov !== undefined) {
      updates.fov = yield* SettingsFactory.createFOV(command.fov)
    }

    if (command.sensitivity !== undefined) {
      updates.sensitivity = yield* SettingsFactory.createSensitivity(command.sensitivity)
    }

    if (command.smoothing !== undefined) {
      updates.smoothing = yield* SettingsFactory.createSmoothing(command.smoothing)
    }

    if (command.aspectRatio !== undefined) {
      updates.aspectRatio = yield* SettingsFactory.createAspectRatio(command.aspectRatio)
    }

    return updates
  })

const handleUpdatePosition = (
  repository: CameraStateRepositoryService,
  command: UpdateCameraPositionCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const position = yield* createPosition3D(command.position.x, command.position.y, command.position.z)
    const updated = yield* CameraOps.updatePosition(camera, position)
    yield* repository.save(updated)
    return cameraToSnapshot(updated)
  })

const handleUpdateRotation = (
  repository: CameraStateRepositoryService,
  command: UpdateCameraRotationCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const rotation = yield* createCameraRotation(
      command.rotation.pitch,
      command.rotation.yaw,
      command.rotation.roll ?? 0
    )
    const updated = yield* CameraOps.updateRotation(camera, rotation)
    yield* repository.save(updated)
    return cameraToSnapshot(updated)
  })

const handleSwitchMode = (
  repository: CameraStateRepositoryService,
  command: SwitchCameraModeCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const viewMode = yield* toViewMode(command.mode)
    const updated = yield* CameraOps.changeViewMode(camera, viewMode)
    yield* repository.save(updated)
    return cameraToSnapshot(updated)
  })

const handleUpdateSettings = (
  repository: CameraStateRepositoryService,
  command: UpdateCameraSettingsCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const updates = yield* buildSettingsUpdate(command)

    if (Object.keys(updates).length === 0) {
      return cameraToSnapshot(camera)
    }

    const updated = yield* CameraOps.updateSettings(camera, updates)
    yield* repository.save(updated)
    return cameraToSnapshot(updated)
  })

const handleCommand = (
  repository: CameraStateRepositoryService,
  command: CameraCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Match.value(command).pipe(
    Match.tag('UpdateCameraPosition', (cmd) => handleUpdatePosition(repository, cmd)),
    Match.tag('UpdateCameraRotation', (cmd) => handleUpdateRotation(repository, cmd)),
    Match.tag('SwitchCameraMode', (cmd) => handleSwitchMode(repository, cmd)),
    Match.tag('UpdateCameraSettings', (cmd) => handleUpdateSettings(repository, cmd)),
    Match.exhaustive
  )

export const CameraCommandHandlerLive = Layer.effect(
  CameraCommandHandler,
  Effect.gen(function* () {
    const repository = yield* CameraStateRepository

    return CameraCommandHandler.of({
      handle: (command) => handleCommand(repository, command),
    })
  })
)
