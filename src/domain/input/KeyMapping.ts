import { Schema } from 'effect'

// キーマッピングアクション
export const KeyAction = Schema.Literal(
  'forward',
  'backward',
  'left',
  'right',
  'jump',
  'crouch',
  'sprint',
  'interact',
  'inventory',
  'chat',
  'debug',
  'screenshot',
  'fullscreen',
  'togglePerspective'
)
export type KeyAction = Schema.Schema.Type<typeof KeyAction>

// キーマッピング設定
export const KeyMappingConfig = Schema.Struct({
  forward: Schema.String,
  backward: Schema.String,
  left: Schema.String,
  right: Schema.String,
  jump: Schema.String,
  crouch: Schema.String,
  sprint: Schema.String,
  interact: Schema.String,
  inventory: Schema.String,
  chat: Schema.String,
  debug: Schema.String,
  screenshot: Schema.String,
  fullscreen: Schema.String,
  togglePerspective: Schema.String,
})
export type KeyMappingConfig = Schema.Schema.Type<typeof KeyMappingConfig>

// デフォルトキーマッピング
export const DefaultKeyMap: KeyMappingConfig = {
  forward: 'W',
  backward: 'S',
  left: 'A',
  right: 'D',
  jump: 'Space',
  crouch: 'Shift',
  sprint: 'Control',
  interact: 'E',
  inventory: 'I',
  chat: 'T',
  debug: 'F3',
  screenshot: 'F2',
  fullscreen: 'F11',
  togglePerspective: 'F5',
}

// カスタムキーマッピング設定
export const CustomKeyMapping = Schema.Struct({
  config: KeyMappingConfig,
  createdAt: Schema.Number.pipe(Schema.positive()),
  updatedAt: Schema.Number.pipe(Schema.positive()),
})
export type CustomKeyMapping = Schema.Schema.Type<typeof CustomKeyMapping>

// キーマッピングエラー
export const KeyMappingErrorSchema = Schema.Struct({
  _tag: Schema.Literal('KeyMappingError'),
  message: Schema.String,
  action: Schema.optional(KeyAction),
  key: Schema.optional(Schema.String),
})
export type KeyMappingError = Schema.Schema.Type<typeof KeyMappingErrorSchema>

export const KeyMappingError = (params: Omit<KeyMappingError, '_tag'>): KeyMappingError => ({
  _tag: 'KeyMappingError' as const,
  ...params,
})
