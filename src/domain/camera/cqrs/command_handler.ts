import { Context, Effect, Layer, Match, Option, pipe, ReadonlyArray, Function } from 'effect'

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
import { CameraReadModel } from './read_model'
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

const toViewMode = (mode: string): Effect.Effect<ViewMode, ViewModeError> =>
  pipe(
    Match.value(mode),
    Match.when(
      (value): value is 'first-person' => value === 'first-person',
      () => ViewModeFactory.createFirstPerson(ViewModeDefaultSettings.firstPerson())
    ),
    Match.when((value): value is 'third-person' => value === 'third-person', () => {
      const thirdPerson = ViewModeDefaultSettings.thirdPerson()
      return ViewModeFactory.createThirdPerson(thirdPerson, thirdPerson.distance)
    }),
    Match.when(
      (value): value is 'spectator' => value === 'spectator',
      () => ViewModeFactory.createSpectator(ViewModeDefaultSettings.spectator())
    ),
    Match.when(
      (value): value is 'cinematic' => value === 'cinematic',
      () =>
        ViewModeFactory.createCinematic(ViewModeDefaultSettings.cinematic(), {
          keyframes: [],
          duration: 5,
          loop: false,
        })
    ),
    Match.orElse(() => Effect.fail(ViewModeError.InvalidMode({ mode })))
  )

const buildSettingsUpdate = (
  command: UpdateCameraSettingsCommand
): Effect.Effect<Partial<CameraSettings>, SettingsError> =>
  Effect.gen(function* () {
    const fovUpdate = yield* pipe(
      Option.fromNullable(command.fov),
      Option.match({
        onNone: () => Effect.succeed(Option.none<readonly ['fov', CameraSettings['fov']]>()),
        onSome: (value) => pipe(SettingsFactory.createFOV(value), Effect.map((validated) => Option.some(['fov', validated] as const))),
      })
    )

    const sensitivityUpdate = yield* pipe(
      Option.fromNullable(command.sensitivity),
      Option.match({
        onNone: () => Effect.succeed(Option.none<readonly ['sensitivity', CameraSettings['sensitivity']]>()),
        onSome: (value) =>
          pipe(SettingsFactory.createSensitivity(value), Effect.map((validated) => Option.some(['sensitivity', validated] as const))),
      })
    )

    const smoothingUpdate = yield* pipe(
      Option.fromNullable(command.smoothing),
      Option.match({
        onNone: () => Effect.succeed(Option.none<readonly ['smoothing', CameraSettings['smoothing']]>()),
        onSome: (value) =>
          pipe(SettingsFactory.createSmoothing(value), Effect.map((validated) => Option.some(['smoothing', validated] as const))),
      })
    )

    const aspectRatioUpdate = yield* pipe(
      Option.fromNullable(command.aspectRatio),
      Option.match({
        onNone: () => Effect.succeed(Option.none<readonly ['aspectRatio', CameraSettings['aspectRatio']]>()),
        onSome: (value) =>
          pipe(
            SettingsFactory.createAspectRatio(value),
            Effect.map((validated) => Option.some(['aspectRatio', validated] as const))
          ),
      })
    )

    return pipe(
      [fovUpdate, sensitivityUpdate, smoothingUpdate, aspectRatioUpdate],
      ReadonlyArray.filterMap(Function.identity),
      ReadonlyArray.reduce({} as Partial<CameraSettings>, (acc, [key, value]) => ({
        ...acc,
        [key]: value,
      }))
    )
  })

const handleUpdatePosition = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
  command: UpdateCameraPositionCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const position = yield* createPosition3D(command.position.x, command.position.y, command.position.z)
    const updated = yield* CameraOps.updatePosition(camera, position)
    yield* repository.save(updated)
    yield* readModel.upsert(updated)
    return cameraToSnapshot(updated)
  })

const handleUpdateRotation = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
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
    yield* readModel.upsert(updated)
    return cameraToSnapshot(updated)
  })

const handleSwitchMode = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
  command: SwitchCameraModeCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const viewMode = yield* toViewMode(command.mode)
    const updated = yield* CameraOps.changeViewMode(camera, viewMode)
    yield* repository.save(updated)
    yield* readModel.upsert(updated)
    return cameraToSnapshot(updated)
  })

const handleUpdateSettings = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
  command: UpdateCameraSettingsCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Effect.gen(function* () {
    const camera = yield* ensureCameraExists(repository, command.cameraId)
    const updates = yield* buildSettingsUpdate(command)
    const result = yield* pipe(
      Match.value(Object.keys(updates).length),
      Match.when(
        (count) => count === 0,
        () => Effect.succeed(camera)
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
          const updated = yield* CameraOps.updateSettings(camera, updates)
          yield* repository.save(updated)
          yield* readModel.upsert(updated)
          return updated
        })
      )
    )

    return cameraToSnapshot(result)
  })

const handleCommand = (
  repository: CameraStateRepositoryService,
  readModel: CameraReadModel,
  command: CameraCommand
): Effect.Effect<CameraSnapshot, CameraCommandHandlerError> =>
  Match.value(command).pipe(
    Match.tag('UpdateCameraPosition', (cmd) => handleUpdatePosition(repository, readModel, cmd)),
    Match.tag('UpdateCameraRotation', (cmd) => handleUpdateRotation(repository, readModel, cmd)),
    Match.tag('SwitchCameraMode', (cmd) => handleSwitchMode(repository, readModel, cmd)),
    Match.tag('UpdateCameraSettings', (cmd) => handleUpdateSettings(repository, readModel, cmd)),
    Match.exhaustive
  )

export const CameraCommandHandlerLive = Layer.effect(
  CameraCommandHandler,
  Effect.gen(function* () {
    const repository = yield* CameraStateRepository
    const readModel = yield* CameraReadModel

    return CameraCommandHandler.of({
      handle: (command) => handleCommand(repository, readModel, command),
    })
  })
)
