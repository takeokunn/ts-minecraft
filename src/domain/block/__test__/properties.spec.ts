import { it } from '@effect/vitest'
import { Effect, pipe } from 'effect'
import { describe, expect } from 'vitest'
import {
  defaultBlockProperties,
  dirtProperties,
  glassProperties,
  leavesProperties,
  liquidProperties,
  oreProperties,
  plantProperties,
  stoneProperties,
  unbreakableProperties,
  withDrop,
  withDropSelf,
  withFlammable,
  withGravity,
  withHardness,
  withLuminance,
  withNoDrops,
  withOpacity,
  withReplaceable,
  withResistance,
  withSimpleTexture,
  withSolid,
  withSound,
  withSoundGroup,
  withTag,
  withTexture,
  withTexturePerFace,
  withTool,
  withWaterloggable,
  woodProperties,
  woolProperties,
} from '../properties'

describe('BlockProperties', () => {
  describe('defaultBlockProperties', () => {
    it.effect('デフォルトプロパティを提供する', () =>
      Effect.gen(function* () {
        const props = defaultBlockProperties

        expect(props.physics.hardness).toBe(1.0)
        expect(props.physics.resistance).toBe(1.0)
        expect(props.physics.luminance).toBe(0)
        expect(props.physics.opacity).toBe(15)
        expect(props.physics.flammable).toBe(false)
        expect(props.physics.gravity).toBe(false)
        expect(props.physics.solid).toBe(true)
        expect(props.physics.replaceable).toBe(false)
        expect(props.physics.waterloggable).toBe(false)

        expect(props.texture).toBe('missing')
        expect(props.tool).toBe('none')
        expect(props.minToolLevel).toBe(0)
        expect(props.drops).toEqual([])
        expect(props.tags).toEqual([])
      })
    )
  })

  describe('Physics modifiers', () => {
    it.effect('withHardnessで硬度を設定できる', () =>
      Effect.gen(function* () {
        const props = withHardness(2.5)(defaultBlockProperties)
        expect(props.physics.hardness).toBe(2.5)
      })
    )

    it.effect('withResistanceで耐性を設定できる', () =>
      Effect.gen(function* () {
        const props = withResistance(10.0)(defaultBlockProperties)
        expect(props.physics.resistance).toBe(10.0)
      })
    )

    it.effect('withLuminanceで光度を設定できる（0-15の範囲）', () =>
      Effect.gen(function* () {
        const props1 = withLuminance(10)(defaultBlockProperties)
        expect(props1.physics.luminance).toBe(10)

        const props2 = withLuminance(20)(defaultBlockProperties)
        expect(props2.physics.luminance).toBe(15) // 最大値にクランプ

        const props3 = withLuminance(-5)(defaultBlockProperties)
        expect(props3.physics.luminance).toBe(0) // 最小値にクランプ
      })
    )

    it.effect('withOpacityで不透明度を設定できる（0-15の範囲）', () =>
      Effect.gen(function* () {
        const props1 = withOpacity(5)(defaultBlockProperties)
        expect(props1.physics.opacity).toBe(5)

        const props2 = withOpacity(20)(defaultBlockProperties)
        expect(props2.physics.opacity).toBe(15) // 最大値にクランプ

        const props3 = withOpacity(-5)(defaultBlockProperties)
        expect(props3.physics.opacity).toBe(0) // 最小値にクランプ
      })
    )

    it.effect('withFlammableで可燃性を設定できる', () =>
      Effect.gen(function* () {
        const props1 = withFlammable()(defaultBlockProperties)
        expect(props1.physics.flammable).toBe(true)

        const props2 = withFlammable(false)(defaultBlockProperties)
        expect(props2.physics.flammable).toBe(false)
      })
    )

    it.effect('withGravityで重力影響を設定できる', () =>
      Effect.gen(function* () {
        const props = withGravity()(defaultBlockProperties)
        expect(props.physics.gravity).toBe(true)
      })
    )

    it.effect('withSolidで固体状態を設定できる', () =>
      Effect.gen(function* () {
        const props = withSolid(false)(defaultBlockProperties)
        expect(props.physics.solid).toBe(false)
      })
    )

    it.effect('withReplaceableで置換可能性を設定できる', () =>
      Effect.gen(function* () {
        const props = withReplaceable()(defaultBlockProperties)
        expect(props.physics.replaceable).toBe(true)
      })
    )

    it.effect('withWaterloggableで水没可能性を設定できる', () =>
      Effect.gen(function* () {
        const props = withWaterloggable()(defaultBlockProperties)
        expect(props.physics.waterloggable).toBe(true)
      })
    )
  })

  describe('Texture modifiers', () => {
    it.effect('withTextureで任意のテクスチャを設定できる', () =>
      Effect.gen(function* () {
        const props1 = withTexture('stone')(defaultBlockProperties)
        expect(props1.texture).toBe('stone')

        const textureFaces = {
          top: 'grass_top',
          bottom: 'dirt',
          north: 'grass_side',
          south: 'grass_side',
          east: 'grass_side',
          west: 'grass_side',
        }
        const props2 = withTexture(textureFaces)(defaultBlockProperties)
        expect(props2.texture).toEqual(textureFaces)
      })
    )

    it.effect('withSimpleTextureで単純なテクスチャを設定できる', () =>
      Effect.gen(function* () {
        const props = withSimpleTexture('cobblestone')(defaultBlockProperties)
        expect(props.texture).toBe('cobblestone')
      })
    )

    it.effect('withTexturePerFaceで面別テクスチャを設定できる', () =>
      Effect.gen(function* () {
        const props = withTexturePerFace({
          top: 'log_top',
          bottom: 'log_top',
          north: 'log_side',
        })(defaultBlockProperties)

        expect(props.texture).toEqual({
          top: 'log_top',
          bottom: 'log_top',
          north: 'log_side',
          south: 'missing',
          east: 'missing',
          west: 'missing',
        })
      })
    )

    it.effect('withTexturePerFaceで既存テクスチャをデフォルトとして使用する', () =>
      Effect.gen(function* () {
        const props = pipe(
          defaultBlockProperties,
          withTexture('oak_log'),
          withTexturePerFace({
            top: 'oak_log_top',
            bottom: 'oak_log_top',
          })
        )

        expect(props.texture).toEqual({
          top: 'oak_log_top',
          bottom: 'oak_log_top',
          north: 'oak_log',
          south: 'oak_log',
          east: 'oak_log',
          west: 'oak_log',
        })
      })
    )
  })

  describe('Tool modifiers', () => {
    it.effect('withToolでツールと最小レベルを設定できる', () =>
      Effect.gen(function* () {
        const props = withTool('pickaxe', 2)(defaultBlockProperties)
        expect(props.tool).toBe('pickaxe')
        expect(props.minToolLevel).toBe(2)
      })
    )

    it.effect('withToolでレベルを省略した場合はデフォルト0', () =>
      Effect.gen(function* () {
        const props = withTool('axe')(defaultBlockProperties)
        expect(props.tool).toBe('axe')
        expect(props.minToolLevel).toBe(0)
      })
    )
  })

  describe('Drop modifiers', () => {
    it.effect('withDropでドロップアイテムを追加できる', () =>
      Effect.gen(function* () {
        const props = withDrop('diamond', 1, 3, 0.5)(defaultBlockProperties)
        expect(props.drops).toEqual([
          {
            itemId: 'diamond',
            minCount: 1,
            maxCount: 3,
            chance: 0.5,
          },
        ])
      })
    )

    it.effect('withDropで複数のドロップを追加できる', () =>
      Effect.gen(function* () {
        const props = pipe(defaultBlockProperties, withDrop('wheat', 1, 1, 1.0), withDrop('wheat_seeds', 0, 3, 1.0))

        expect(props.drops).toHaveLength(2)
        expect(props.drops[0]?.itemId).toBe('wheat')
        expect(props.drops[1]?.itemId).toBe('wheat_seeds')
      })
    )

    it.effect('withDropSelfで自身をドロップする設定ができる', () =>
      Effect.gen(function* () {
        const props = withDropSelf(defaultBlockProperties)
        expect(props.drops).toEqual([
          {
            itemId: 'self',
            minCount: 1,
            maxCount: 1,
            chance: 1.0,
          },
        ])
      })
    )

    it.effect('withNoDropsでドロップをクリアできる', () =>
      Effect.gen(function* () {
        const props = pipe(
          defaultBlockProperties,
          withDrop('item1', 1, 1, 1.0),
          withDrop('item2', 1, 1, 1.0),
          withNoDrops
        )

        expect(props.drops).toEqual([])
      })
    )
  })

  describe('Sound modifiers', () => {
    it.effect('withSoundで個別のサウンドを設定できる', () =>
      Effect.gen(function* () {
        const props = withSound({
          break: 'custom.break',
          place: 'custom.place',
        })(defaultBlockProperties)

        expect(props.sound.break).toBe('custom.break')
        expect(props.sound.place).toBe('custom.place')
        expect(props.sound.step).toBe('block.stone.step') // デフォルト値
      })
    )

    it.effect('withSoundGroupでサウンドグループを設定できる', () =>
      Effect.gen(function* () {
        const groups = ['stone', 'wood', 'gravel', 'grass', 'metal', 'glass', 'wool', 'sand'] as const

        groups.forEach((group) => {
          const props = withSoundGroup(group)(defaultBlockProperties)
          expect(props.sound.break).toBe(`block.${group}.break`)
          expect(props.sound.place).toBe(`block.${group}.place`)
          expect(props.sound.step).toBe(`block.${group}.step`)
        })
      })
    )
  })

  describe('Tag modifiers', () => {
    it.effect('withTagでタグを追加できる', () =>
      Effect.gen(function* () {
        const props = withTag('mineable')(defaultBlockProperties)
        expect(props.tags).toEqual(['mineable'])
      })
    )

    it.effect('withTagで重複タグは追加されない', () =>
      Effect.gen(function* () {
        const props = pipe(
          defaultBlockProperties,
          withTag('mineable'),
          withTag('stone'),
          withTag('mineable') // 重複
        )

        expect(props.tags).toEqual(['mineable', 'stone'])
      })
    )
  })

  describe('Preset properties', () => {
    it.effect('stonePropertiesが石のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = stoneProperties()
        expect(props.physics.hardness).toBe(1.5)
        expect(props.physics.resistance).toBe(6.0)
        expect(props.tool).toBe('pickaxe')
        expect(props.minToolLevel).toBe(0)
        expect(props.sound.break).toBe('block.stone.break')
        expect(props.drops).toEqual([{ itemId: 'self', minCount: 1, maxCount: 1, chance: 1.0 }])
      })
    )

    it.effect('dirtPropertiesが土のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = dirtProperties()
        expect(props.physics.hardness).toBe(0.5)
        expect(props.physics.resistance).toBe(0.5)
        expect(props.tool).toBe('shovel')
        expect(props.sound.break).toBe('block.gravel.break')
      })
    )

    it.effect('woodPropertiesが木材のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = woodProperties()
        expect(props.physics.hardness).toBe(2.0)
        expect(props.physics.resistance).toBe(2.0)
        expect(props.physics.flammable).toBe(true)
        expect(props.tool).toBe('axe')
        expect(props.sound.break).toBe('block.wood.break')
      })
    )

    it.effect('leavesPropertiesが葉のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = leavesProperties()
        expect(props.physics.hardness).toBe(0.2)
        expect(props.physics.resistance).toBe(0.2)
        expect(props.physics.flammable).toBe(true)
        expect(props.physics.opacity).toBe(1)
        expect(props.tool).toBe('shears')
      })
    )

    it.effect('glassPropertiesがガラスのプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = glassProperties()
        expect(props.physics.hardness).toBe(0.3)
        expect(props.physics.resistance).toBe(0.3)
        expect(props.physics.opacity).toBe(0)
        expect(props.drops).toEqual([])
      })
    )

    it.effect('orePropertiesが鉱石のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = oreProperties(3.0, 2)
        expect(props.physics.hardness).toBe(3.0)
        expect(props.physics.resistance).toBe(3.0)
        expect(props.tool).toBe('pickaxe')
        expect(props.minToolLevel).toBe(2)
      })
    )

    it.effect('liquidPropertiesが液体のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = liquidProperties()
        expect(props.physics.hardness).toBe(-1.0)
        expect(props.physics.resistance).toBe(100.0)
        expect(props.physics.opacity).toBe(3)
        expect(props.physics.solid).toBe(false)
        expect(props.physics.replaceable).toBe(true)
      })
    )

    it.effect('plantPropertiesが植物のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = plantProperties()
        expect(props.physics.hardness).toBe(0.0)
        expect(props.physics.resistance).toBe(0.0)
        expect(props.physics.solid).toBe(false)
        expect(props.physics.replaceable).toBe(true)
      })
    )

    it.effect('unbreakablePropertiesが破壊不可のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = unbreakableProperties()
        expect(props.physics.hardness).toBe(-1.0)
        expect(props.physics.resistance).toBe(3600000.0)
        expect(props.drops).toEqual([])
      })
    )

    it.effect('woolPropertiesが羊毛のプリセットを提供する', () =>
      Effect.gen(function* () {
        const props = woolProperties()
        expect(props.physics.hardness).toBe(0.8)
        expect(props.physics.flammable).toBe(true)
        expect(props.sound.break).toBe('block.wool.break')
      })
    )
  })

  describe('Composition', () => {
    it.effect('pipeを使って複数の修飾子を合成できる', () =>
      Effect.gen(function* () {
        const props = pipe(
          defaultBlockProperties,
          withHardness(2.0),
          withResistance(6.0),
          withTool('pickaxe', 1),
          withSoundGroup('stone'),
          withTexture('cobblestone'),
          withDropSelf,
          withTag('mineable'),
          withTag('stone')
        )

        expect(props.physics.hardness).toBe(2.0)
        expect(props.physics.resistance).toBe(6.0)
        expect(props.tool).toBe('pickaxe')
        expect(props.minToolLevel).toBe(1)
        expect(props.sound.break).toBe('block.stone.break')
        expect(props.texture).toBe('cobblestone')
        expect(props.drops).toHaveLength(1)
        expect(props.tags).toEqual(['mineable', 'stone'])
      })
    )

    it.effect('プリセットから開始して修飾できる', () =>
      Effect.gen(function* () {
        const props = pipe(
          stoneProperties(),
          withHardness(50.0),
          withResistance(1200.0),
          withTool('pickaxe', 3),
          withTexture('obsidian')
        )

        expect(props.physics.hardness).toBe(50.0)
        expect(props.physics.resistance).toBe(1200.0)
        expect(props.minToolLevel).toBe(3)
        expect(props.texture).toBe('obsidian')
      })
    )
  })
})
