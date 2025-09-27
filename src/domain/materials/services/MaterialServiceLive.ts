import { Array, Duration, Effect, HashMap, Layer, Match, Option, pipe } from 'effect'
import {
  BlastResistance,
  BlockId,
  BurnTime,
  Hardness,
  ItemId,
  Material,
  MaterialCategory,
  MaterialId,
  MaterialNotFoundError,
  MiningSpeed,
  Tool,
  ToolType,
} from '../types/MaterialTypes'
import { MaterialService } from './MaterialService'

// ヘルパー関数
const getToolHarvestLevel = (material: MaterialCategory): number =>
  Match.value(material).pipe(
    Match.when('wood', () => 0),
    Match.when('stone', () => 1),
    Match.when('iron', () => 2),
    Match.when('gold', () => 0), // ゴールドは特殊
    Match.when('diamond', () => 3),
    Match.when('netherite', () => 4),
    Match.orElse(() => 0)
  )

const blockIdToItemId = (blockId: BlockId): ItemId => blockId as unknown as ItemId // 実際にはより適切な変換が必要

const makeMaterialService = Effect.gen(function* () {
  // マテリアルデータベース
  const materials = HashMap.make(
    [
      'stone' as BlockId,
      {
        id: 'stone' as MaterialId,
        category: 'stone' as MaterialCategory,
        hardness: 1.5 as Hardness,
        blastResistance: 6 as BlastResistance,
        isFlammable: false,
        requiresTool: true,
        preferredTool: 'pickaxe' as ToolType,
        harvestLevel: 0,
        drops: [{ itemId: 'cobblestone' as ItemId, amount: 1 }],
        luminance: 0,
      },
    ],
    [
      'wood' as BlockId,
      {
        id: 'wood' as MaterialId,
        category: 'wood' as MaterialCategory,
        hardness: 2 as Hardness,
        blastResistance: 3 as BlastResistance,
        isFlammable: true,
        burnTime: 300 as BurnTime,
        requiresTool: false,
        preferredTool: 'axe' as ToolType,
        harvestLevel: 0,
        drops: [{ itemId: 'wood' as ItemId, amount: 1 }],
        luminance: 0,
      },
    ],
    [
      'diamond_ore' as BlockId,
      {
        id: 'diamond_ore' as MaterialId,
        category: 'stone' as MaterialCategory,
        hardness: 3 as Hardness,
        blastResistance: 3 as BlastResistance,
        isFlammable: false,
        requiresTool: true,
        preferredTool: 'pickaxe' as ToolType,
        harvestLevel: 2, // Iron pickaxe required
        drops: [{ itemId: 'diamond' as ItemId, amount: 1 }],
        luminance: 0,
      },
    ],
    [
      'obsidian' as BlockId,
      {
        id: 'obsidian' as MaterialId,
        category: 'stone' as MaterialCategory,
        hardness: 50 as Hardness,
        blastResistance: 1200 as BlastResistance,
        isFlammable: false,
        requiresTool: true,
        preferredTool: 'pickaxe' as ToolType,
        harvestLevel: 3, // Diamond pickaxe required
        drops: [{ itemId: 'obsidian' as ItemId, amount: 1 }],
        luminance: 0,
      },
    ],
    [
      'sand' as BlockId,
      {
        id: 'sand' as MaterialId,
        category: 'sand' as MaterialCategory,
        hardness: 0.5 as Hardness,
        blastResistance: 0.5 as BlastResistance,
        isFlammable: false,
        requiresTool: false,
        preferredTool: 'shovel' as ToolType,
        harvestLevel: 0,
        drops: [{ itemId: 'sand' as ItemId, amount: 1 }],
        luminance: 0,
      },
    ],
    [
      'leaves' as BlockId,
      {
        id: 'leaves' as MaterialId,
        category: 'leaves' as MaterialCategory,
        hardness: 0.2 as Hardness,
        blastResistance: 0.2 as BlastResistance,
        isFlammable: true,
        burnTime: 100 as BurnTime,
        requiresTool: false,
        preferredTool: 'shears' as ToolType,
        harvestLevel: 0,
        drops: [], // 通常は何もドロップしない
        luminance: 0,
      },
    ]
  )

  // ツール効率マトリックス
  const toolEfficiencyMatrix = HashMap.make(
    [
      'pickaxe:diamond:stone',
      {
        toolType: 'pickaxe',
        toolMaterial: 'diamond',
        targetMaterial: 'stone',
        speedMultiplier: 8 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'pickaxe:iron:stone',
      {
        toolType: 'pickaxe',
        toolMaterial: 'iron',
        targetMaterial: 'stone',
        speedMultiplier: 6 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'pickaxe:stone:stone',
      {
        toolType: 'pickaxe',
        toolMaterial: 'stone',
        targetMaterial: 'stone',
        speedMultiplier: 4 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'pickaxe:wood:stone',
      {
        toolType: 'pickaxe',
        toolMaterial: 'wood',
        targetMaterial: 'stone',
        speedMultiplier: 2 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'axe:diamond:wood',
      {
        toolType: 'axe',
        toolMaterial: 'diamond',
        targetMaterial: 'wood',
        speedMultiplier: 8 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'axe:iron:wood',
      {
        toolType: 'axe',
        toolMaterial: 'iron',
        targetMaterial: 'wood',
        speedMultiplier: 6 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'axe:stone:wood',
      {
        toolType: 'axe',
        toolMaterial: 'stone',
        targetMaterial: 'wood',
        speedMultiplier: 4 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'axe:wood:wood',
      {
        toolType: 'axe',
        toolMaterial: 'wood',
        targetMaterial: 'wood',
        speedMultiplier: 2 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'shovel:diamond:sand',
      {
        toolType: 'shovel',
        toolMaterial: 'diamond',
        targetMaterial: 'sand',
        speedMultiplier: 8 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'shovel:iron:sand',
      {
        toolType: 'shovel',
        toolMaterial: 'iron',
        targetMaterial: 'sand',
        speedMultiplier: 6 as MiningSpeed,
        canHarvest: true,
      },
    ],
    [
      'shears:iron:leaves',
      {
        toolType: 'shears',
        toolMaterial: 'iron',
        targetMaterial: 'leaves',
        speedMultiplier: 15 as MiningSpeed, // シアーズは非常に速い
        canHarvest: true,
      },
    ]
  )

  const getMaterial = (blockId: BlockId) =>
    Effect.gen(function* () {
      const material = HashMap.get(materials, blockId)
      if (Option.isNone(material)) {
        return yield* Effect.fail(new MaterialNotFoundError({ blockId }))
      }
      return material.value
    })

  const calculateMiningTime = (material: Material, tool: Option.Option<Tool>) =>
    Effect.gen(function* () {
      const baseTime = material.hardness * 1.5 // 秒

      // ツールなしの場合
      if (Option.isNone(tool)) {
        // 素手での採掘
        const canMineByHand = !material.requiresTool
        if (!canMineByHand) {
          return Duration.infinity
        }
        return Duration.seconds(baseTime * 5)
      }

      const actualTool = tool.value

      // ツール効率の取得
      const efficiencyKey = `${actualTool.type}:${actualTool.material}:${material.category}`
      const efficiency = HashMap.get(toolEfficiencyMatrix, efficiencyKey)

      const speedMultiplier = pipe(
        efficiency,
        Option.map((e) => e.speedMultiplier),
        Option.getOrElse(() => 1 as MiningSpeed)
      )

      // エンチャント効果の適用
      const efficiencyEnchantLevel = pipe(
        actualTool.enchantments,
        Array.findFirst((e: any) => e.type === 'efficiency'),
        Option.map((e: any) => e.level),
        Option.getOrElse(() => 0)
      )

      const enchantmentBonus = 1 + efficiencyEnchantLevel * 0.3

      const finalTime = baseTime / (speedMultiplier * enchantmentBonus)
      return Duration.seconds(finalTime)
    })

  const getDrops = (material: Material, tool: Option.Option<Tool>, fortuneLevel: number) =>
    Effect.gen(function* () {
      // 適切なツールでない場合
      const canHarvestResult = yield* canHarvest(material, tool)
      if (!canHarvestResult) {
        return []
      }

      // 基本ドロップ
      const baseDrops = material.drops

      // Silk Touch エンチャントの適用
      const hasSilkTouch = pipe(
        tool,
        Option.flatMap((t) => Array.findFirst(t.enchantments, (e: any) => e.type === 'silk_touch')),
        Option.isSome
      )

      if (hasSilkTouch) {
        return [{ itemId: blockIdToItemId(material.id as unknown as BlockId), amount: 1 }]
      }

      // Fortune エンチャントの適用
      if (fortuneLevel > 0 && material.category !== 'stone') {
        return pipe(
          baseDrops,
          Array.map((stack: any) => {
            const bonusChance = fortuneLevel * 0.33
            const multiplier = Math.random() < bonusChance ? 2 : 1
            return { itemId: stack.itemId, amount: stack.amount * multiplier }
          })
        )
      }

      return baseDrops
    })

  const canHarvest = (material: Material, tool: Option.Option<Tool>) =>
    Effect.gen(function* () {
      // ツールが必要ない場合
      if (!material.requiresTool) {
        return true
      }

      // ツールなしの場合
      if (Option.isNone(tool)) {
        return false
      }

      const actualTool = tool.value

      // 適切なツールタイプか確認
      if (material.preferredTool && actualTool.type !== material.preferredTool) {
        return false
      }

      // ハーベストレベルの確認
      const toolLevel = getToolHarvestLevel(actualTool.material)
      return toolLevel >= material.harvestLevel
    })

  const getBurnTime = (itemId: ItemId) =>
    Effect.gen(function* () {
      // アイテムに対応するマテリアルを検索
      const material = yield* Effect.succeed(
        pipe(
          HashMap.values(materials),
          Array.fromIterable,
          Array.findFirst((m: Material) => m.drops.some((drop: any) => drop.itemId === itemId))
        )
      )

      return pipe(
        material,
        Option.flatMap((m: Material) => Option.fromNullable(m.burnTime))
      )
    })

  return MaterialService.of({
    getMaterial,
    calculateMiningTime,
    getDrops,
    canHarvest,
    getBurnTime,
  })
})

export const MaterialServiceLive = Layer.effect(MaterialService, makeMaterialService)
