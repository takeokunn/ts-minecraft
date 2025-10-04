import { Schema } from 'effect'
import { Data, Option } from 'effect'

// ===== Brand 定義 =====

export const SceneIdSchema = Schema.String.pipe(Schema.brand('SceneId'))
export type SceneId = Schema.Schema.Type<typeof SceneIdSchema>

export const TransitionDurationSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('TransitionDuration')
)
export type TransitionDuration = Schema.Schema.Type<typeof TransitionDurationSchema>

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>

export const SaveIdSchema = Schema.String.pipe(Schema.brand('SaveId'))
export type SaveId = Schema.Schema.Type<typeof SaveIdSchema>

export const SceneTimestampSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('SceneTimestamp')
)
export type SceneTimestamp = Schema.Schema.Type<typeof SceneTimestampSchema>

export const SceneProgressSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('SceneProgress')
)
export type SceneProgress = Schema.Schema.Type<typeof SceneProgressSchema>

export const ResourceSizeSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('ResourceSize')
)
export type ResourceSize = Schema.Schema.Type<typeof ResourceSizeSchema>

// ===== 値オブジェクト =====

export const MenuOption = Schema.Literal('NewGame', 'LoadGame', 'Settings', 'Exit')
export type MenuOption = Schema.Schema.Type<typeof MenuOption>

export const Direction = Schema.Literal('Up', 'Down', 'Left', 'Right')
export type Direction = Schema.Schema.Type<typeof Direction>

export const PlayerStateSchema = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  health: Schema.Number.pipe(Schema.between(0, 100)),
  hunger: Schema.Number.pipe(Schema.between(0, 100)),
})
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>

export const ErrorInfoSchema = Schema.Struct({
  message: Schema.String,
  stack: Schema.Option(Schema.String),
  timestamp: SceneTimestampSchema,
})
export type ErrorInfo = Schema.Schema.Type<typeof ErrorInfoSchema>

// ===== シーンADT =====

export interface MainMenuScene {
  readonly _tag: 'MainMenu'
  readonly selectedOption: Option.Option<MenuOption>
}

export interface GameWorldScene {
  readonly _tag: 'GameWorld'
  readonly worldId: WorldId
  readonly playerState: PlayerState
}

export interface SettingsScene {
  readonly _tag: 'Settings'
  readonly returnTo: Option.Option<ActiveSceneKind>
}

export interface ErrorScene {
  readonly _tag: 'Error'
  readonly error: ErrorInfo
  readonly recoverable: boolean
}

export type ActiveScene = MainMenuScene | GameWorldScene | SettingsScene | ErrorScene
export type ActiveSceneKind = ActiveScene['_tag']

export interface LoadingScene {
  readonly _tag: 'Loading'
  readonly target: ActiveScene
  readonly progress: SceneProgress
}

export type SceneState = ActiveScene | LoadingScene
export type SceneKind = SceneState['_tag']

const defaultSceneProgress = Schema.decodeUnknownSync(SceneProgressSchema)(0)

export const MainMenuSceneSchema = Schema.Struct({
  _tag: Schema.Literal('MainMenu'),
  selectedOption: Schema.OptionFromSelf(MenuOption),
})
export const GameWorldSceneSchema = Schema.Struct({
  _tag: Schema.Literal('GameWorld'),
  worldId: WorldIdSchema,
  playerState: PlayerStateSchema,
})
export const SettingsSceneSchema = Schema.Struct({
  _tag: Schema.Literal('Settings'),
  returnTo: Schema.OptionFromSelf(
    Schema.Literal('MainMenu', 'GameWorld', 'Settings', 'Error')
  ),
})
export const ErrorSceneSchema = Schema.Struct({
  _tag: Schema.Literal('Error'),
  error: ErrorInfoSchema,
  recoverable: Schema.Boolean,
})

export const ActiveSceneSchema = Schema.Union(
  MainMenuSceneSchema,
  GameWorldSceneSchema,
  SettingsSceneSchema,
  ErrorSceneSchema
)

export const LoadingSceneSchema = Schema.Struct({
  _tag: Schema.Literal('Loading'),
  target: ActiveSceneSchema,
  progress: SceneProgressSchema,
})

export const SceneStateSchema = Schema.Union(ActiveSceneSchema, LoadingSceneSchema)

interface SceneStateConstructors {
  readonly MainMenu: (
    selectedOption?: Option.Option<MenuOption>
  ) => MainMenuScene
  readonly GameWorld: (params: {
    readonly worldId: WorldId
    readonly playerState: PlayerState
  }) => GameWorldScene
  readonly Settings: (
    returnTo?: Option.Option<ActiveSceneKind>
  ) => SettingsScene
  readonly Error: (params: {
    readonly error: ErrorInfo
    readonly recoverable: boolean
  }) => ErrorScene
  readonly Loading: (params: {
    readonly target: ActiveScene
    readonly progress?: SceneProgress
  }) => LoadingScene
}

export const SceneState: SceneStateConstructors = {
  MainMenu: (selectedOption = Option.none()) => ({
    _tag: 'MainMenu',
    selectedOption,
  }),
  GameWorld: (params) => ({
    _tag: 'GameWorld',
    worldId: params.worldId,
    playerState: params.playerState,
  }),
  Settings: (returnTo = Option.none()) => ({
    _tag: 'Settings',
    returnTo,
  }),
  Error: (params) => ({
    _tag: 'Error',
    error: params.error,
    recoverable: params.recoverable,
  }),
  Loading: (params) => ({
    _tag: 'Loading',
    target: params.target,
    progress: params.progress ?? defaultSceneProgress,
  }),
}

// ===== トランジション効果 =====

export type TransitionEffect = Data.TaggedEnum<{
  Fade: { readonly duration: TransitionDuration }
  Slide: { readonly direction: Direction; readonly duration: TransitionDuration }
  Instant: {}
}>

export const TransitionEffect = Data.taggedEnum<TransitionEffect>()

// ===== ドメインエラー =====

export type TransitionError = Data.TaggedEnum<{
  TransitionInProgress: {
    readonly currentScene: Option.Option<SceneState>
    readonly requested: SceneState
  }
  InvalidScene: { readonly requested: SceneState; readonly reason: string }
}>

export const TransitionError = Data.taggedEnum<TransitionError>()

export type SaveError = Data.TaggedEnum<{
  SaveFailed: { readonly message: string; readonly cause: Option.Option<ErrorInfo> }
  InvalidSaveData: { readonly message: string }
}>

export const SaveError = Data.taggedEnum<SaveError>()

export type LoadError = Data.TaggedEnum<{
  LoadFailed: { readonly saveId: SaveId; readonly message: string }
  SaveNotFound: { readonly saveId: SaveId; readonly message: string }
}>

export const LoadError = Data.taggedEnum<LoadError>()

export type PreloadError = Data.TaggedEnum<{
  ResourceNotFound: { readonly resourcePath: string; readonly message: string }
  PreloadFailed: { readonly message: string; readonly resources: ReadonlyArray<string> }
}>

export const PreloadError = Data.taggedEnum<PreloadError>()

// ===== プリロード済みリソース =====

export const ResourceKind = Schema.Literal('texture', 'model', 'sound', 'data')
export type ResourceKind = Schema.Schema.Type<typeof ResourceKind>

export const ResourcePayloadSchema = Schema.OptionFromSelf(Schema.Uint8Array)
export type ResourcePayload = Schema.Schema.Type<typeof ResourcePayloadSchema>

export const PreloadedResourceSchema = Schema.Struct({
  id: Schema.String,
  type: ResourceKind,
  data: ResourcePayloadSchema,
  size: ResourceSizeSchema,
  loadedAt: SceneTimestampSchema,
})
export type PreloadedResource = Schema.Schema.Type<typeof PreloadedResourceSchema>

export const SceneEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('TransitionStarted'),
    from: Schema.OptionFromSelf(SceneStateSchema),
    to: SceneStateSchema,
    duration: TransitionDurationSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('TransitionCompleted'),
    scene: SceneStateSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('LoadingProgress'),
    progress: SceneProgressSchema,
    message: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('StateSnapshot'),
    scene: SceneStateSchema,
    timestamp: SceneTimestampSchema,
  })
)
export type SceneEvent = Schema.Schema.Type<typeof SceneEventSchema>

// ===== デコーダ =====

export const decodeSceneState = Schema.decodeUnknown(SceneStateSchema)
export const encodeSceneState = Schema.encode(SceneStateSchema)
