import * as S from '@effect/schema/Schema'
import { Brand } from 'effect'

// Branded Types
export const SceneId = S.String.pipe(
  S.brand('SceneId')
)
export type SceneId = S.Schema.Type<typeof SceneId>

export const TransitionDuration = S.Number.pipe(
  S.positive(),
  S.brand('TransitionDuration')
)
export type TransitionDuration = S.Schema.Type<typeof TransitionDuration>

export const WorldId = S.String.pipe(
  S.brand('WorldId')
)
export type WorldId = S.Schema.Type<typeof WorldId>

export const SaveId = S.String.pipe(
  S.brand('SaveId')
)
export type SaveId = S.Schema.Type<typeof SaveId>

// Menu Options
export const MenuOption = S.Literal(
  'NewGame',
  'LoadGame',
  'Settings',
  'Exit'
)
export type MenuOption = S.Schema.Type<typeof MenuOption>

// Direction for transitions
export const Direction = S.Literal('Up', 'Down', 'Left', 'Right')
export type Direction = S.Schema.Type<typeof Direction>

// Player State (simplified for now, can be expanded)
export const PlayerState = S.Struct({
  position: S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number
  }),
  health: S.Number.pipe(S.between(0, 100)),
  hunger: S.Number.pipe(S.between(0, 100))
})
export type PlayerState = S.Schema.Type<typeof PlayerState>

// Error Info
export const ErrorInfo = S.Struct({
  message: S.String,
  stack: S.optional(S.String),
  timestamp: S.Number
})
export type ErrorInfo = S.Schema.Type<typeof ErrorInfo>

// Scene Types - Enhanced with tagged unions
export const SceneType: S.Schema<any> = S.Union(
  S.Struct({
    _tag: S.Literal('MainMenu'),
    selectedOption: S.optional(MenuOption)
  }),
  S.Struct({
    _tag: S.Literal('GameWorld'),
    worldId: WorldId,
    playerState: PlayerState
  }),
  S.Struct({
    _tag: S.Literal('Loading'),
    targetScene: S.suspend((): S.Schema<any> => SceneType),
    progress: S.Number.pipe(S.between(0, 1))
  }),
  S.Struct({
    _tag: S.Literal('Settings'),
    previousScene: S.suspend((): S.Schema<any> => SceneType)
  }),
  S.Struct({
    _tag: S.Literal('Error'),
    error: ErrorInfo,
    recoverable: S.Boolean
  })
)
export type SceneType = S.Schema.Type<typeof SceneType>

// Scene Events
export const SceneEvent = S.Union(
  S.Struct({
    _tag: S.Literal('TransitionStarted'),
    from: SceneType,
    to: SceneType,
    duration: TransitionDuration
  }),
  S.Struct({
    _tag: S.Literal('TransitionCompleted'),
    scene: SceneType
  }),
  S.Struct({
    _tag: S.Literal('LoadingProgress'),
    progress: S.Number,
    message: S.String
  }),
  S.Struct({
    _tag: S.Literal('StateSnapshot'),
    scene: SceneType,
    timestamp: S.Number
  })
)
export type SceneEvent = S.Schema.Type<typeof SceneEvent>

// Transition Effects
export const TransitionEffect = S.Union(
  S.Struct({
    _tag: S.Literal('Fade'),
    duration: TransitionDuration
  }),
  S.Struct({
    _tag: S.Literal('Slide'),
    direction: Direction,
    duration: TransitionDuration
  }),
  S.Struct({
    _tag: S.Literal('Instant')
  })
)
export type TransitionEffect = S.Schema.Type<typeof TransitionEffect>

// Error Types
export const TransitionError = S.Union(
  S.Struct({
    _tag: S.Literal('TransitionInProgressError'),
    message: S.String
  }),
  S.Struct({
    _tag: S.Literal('InvalidSceneError'),
    sceneType: S.String,
    message: S.String
  }),
  S.Struct({
    _tag: S.Literal('SceneNotFoundError'),
    sceneId: SceneId,
    message: S.String
  })
)
export type TransitionError = S.Schema.Type<typeof TransitionError>

export const SaveError = S.Union(
  S.Struct({
    _tag: S.Literal('SaveFailedError'),
    message: S.String,
    cause: S.optional(S.String)
  }),
  S.Struct({
    _tag: S.Literal('InvalidSaveDataError'),
    message: S.String
  })
)
export type SaveError = S.Schema.Type<typeof SaveError>

export const LoadError = S.Union(
  S.Struct({
    _tag: S.Literal('LoadFailedError'),
    saveId: SaveId,
    message: S.String
  }),
  S.Struct({
    _tag: S.Literal('SaveNotFoundError'),
    saveId: SaveId,
    message: S.String
  })
)
export type LoadError = S.Schema.Type<typeof LoadError>

export const PreloadError = S.Union(
  S.Struct({
    _tag: S.Literal('ResourceNotFoundError'),
    resourcePath: S.String,
    message: S.String
  }),
  S.Struct({
    _tag: S.Literal('PreloadFailedError'),
    message: S.String,
    resources: S.Array(S.String)
  })
)
export type PreloadError = S.Schema.Type<typeof PreloadError>

// Preloaded Resource
export const PreloadedResource = S.Struct({
  id: S.String,
  type: S.Literal('texture', 'model', 'sound', 'data'),
  data: S.Unknown,
  size: S.Number,
  loadedAt: S.Number
})
export type PreloadedResource = S.Schema.Type<typeof PreloadedResource>