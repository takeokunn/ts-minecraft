/**
 * @fileoverview PresetRegistry Live Implementation
 *
 * プリセットレジストリのLive Layer実装
 */

import { Effect, Layer, Option, Ref } from 'effect'
import type { PresetType } from './index'
import { PresetRegistryService } from './preset_registry_service'
import type { PresetDefinition } from './presets'

/**
 * PresetRegistry Live Layer
 * Refを使用した状態管理による実装
 */
export const PresetRegistryLive = Layer.effect(
  PresetRegistryService,
  Effect.gen(function* () {
    // プリセット定義を保持するRef（イミュータブルMap）
    const presets = yield* Ref.make(new Map<PresetType, PresetDefinition>())

    return PresetRegistryService.of({
      register: (type, definition) => Ref.update(presets, (m) => new Map(m).set(type, definition)),

      get: (type) => Ref.get(presets).pipe(Effect.map((m) => Option.fromNullable(m.get(type)))),

      list: Ref.get(presets).pipe(Effect.map((m) => Array.from(m.keys()))),

      listByCategory: (category) =>
        Ref.get(presets).pipe(
          Effect.map((m) =>
            Array.from(m.entries())
              .filter(([_, definition]) => definition.category === category)
              .map(([type, _]) => type)
          )
        ),
    })
  })
)
