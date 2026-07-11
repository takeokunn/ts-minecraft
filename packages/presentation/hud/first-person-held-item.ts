import { Array as Arr, Effect } from 'effect'
import * as THREE from 'three'
import { InventoryItem } from '@ts-minecraft/core'
import type { HotbarSlotValue } from './hotbar-three-state'
import { getItemTileIndex, getItemTileUVs } from '@ts-minecraft/rendering'

const ITEM_FOV = 50
const ITEM_NEAR = 0.1
const ITEM_FAR = 10
const ITEM_X = 0.72
const ITEM_Y = -0.48
const ITEM_Z = -1.55
const ITEM_ROTATION_X = -0.32
const ITEM_ROTATION_Y = -0.54
const ITEM_ROTATION_Z = -0.16
const BLOCK_SCALE = 0.42
const FLAT_ITEM_SIZE = 0.72
const NARROW_ASPECT = 0.75
const NARROW_ITEM_X = 0.68
const NARROW_ITEM_Y = 0.05
const NARROW_ITEM_Z = -2.2
const NARROW_BLOCK_SCALE = 0.32
const NARROW_FLAT_ITEM_SIZE = 0.58
const SWING_PITCH_RADS = -1.1
const SWING_YAW_RADS = 0.35
const SWING_DROP_UNITS = 0.3
const SWING_FORWARD_UNITS = 0.25

type HeldItemModel = {
  readonly group: THREE.Group
  readonly mesh: THREE.Mesh
  readonly isBlock: boolean
}

type Layout = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly blockScale: number
  readonly flatItemSize: number
}

export type FirstPersonHeldItemPresenter = {
  readonly resize: (width: number, height: number) => void
  readonly replace: (selectedItem: HotbarSlotValue) => void
  readonly render: (renderer: THREE.WebGLRenderer, swingAmount?: number) => Effect.Effect<void>
  readonly dispose: () => void
}

export type FirstPersonHeldItemRenderer = {
  readonly renderOverlay: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) => Effect.Effect<void>
}

const BLOCK_ITEMS: ReadonlySet<InventoryItem> = new Set<InventoryItem>([
  'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL',
  'COBBLESTONE', 'GRANITE', 'DIORITE', 'ANDESITE', 'DEEPSLATE', 'BEDROCK', 'LAVA', 'OBSIDIAN',
  'COAL_ORE', 'IRON_ORE', 'GOLD_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE', 'EMERALD_ORE',
  'DEEPSLATE_COAL_ORE', 'DEEPSLATE_IRON_ORE', 'DEEPSLATE_GOLD_ORE', 'DEEPSLATE_DIAMOND_ORE',
  'DEEPSLATE_REDSTONE_ORE', 'DEEPSLATE_LAPIS_ORE', 'DEEPSLATE_EMERALD_ORE', 'COAL_BLOCK',
  'IRON_BLOCK', 'GOLD_BLOCK', 'DIAMOND_BLOCK', 'REDSTONE_BLOCK', 'LAPIS_BLOCK', 'EMERALD_BLOCK',
  'PLANKS', 'CRAFTING_TABLE', 'FURNACE', 'TORCH', 'NETHERRACK', 'NETHER_PORTAL', 'FARMLAND',
  'WHEAT_CROP', 'REDSTONE_WIRE', 'REDSTONE_TORCH', 'LEVER', 'STONE_BUTTON', 'REPEATER', 'PISTON',
  'BED', 'ENCHANTING_TABLE', 'ANVIL', 'CAULDRON', 'END_STONE', 'END_PORTAL_FRAME', 'END_PORTAL',
  'CHORUS_FLOWER', 'CHORUS_PLANT', 'DRAGON_EGG', 'END_CRYSTAL', 'END_GATEWAY', 'END_ROD',
  'END_STONE_BRICKS', 'ENDER_CHEST', 'PURPUR_BLOCK', 'PURPUR_PILLAR', 'PURPUR_SLAB', 'PURPUR_STAIRS',
  'SHULKER_BOX', 'TNT', 'CHEST', 'DOOR', 'DOOR_OPEN', 'GLOWSTONE', 'LADDER', 'COBWEB', 'SAPLING',
  'DANDELION', 'POPPY', 'BROWN_MUSHROOM', 'RED_MUSHROOM', 'TALL_GRASS', 'FERN', 'SUGAR_CANE',
  'CACTUS', 'LILY_PAD', 'ICE', 'PRESSURE_PLATE', 'STONE_SLAB', 'OAK_STAIRS',
])

const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const getLayout = (aspect: number): Layout => {
  const narrowAmount = clamp01((NARROW_ASPECT - aspect) / NARROW_ASPECT)
  return {
    x: mix(ITEM_X, NARROW_ITEM_X, narrowAmount),
    y: mix(ITEM_Y, NARROW_ITEM_Y, narrowAmount),
    z: mix(ITEM_Z, NARROW_ITEM_Z, narrowAmount),
    blockScale: mix(BLOCK_SCALE, NARROW_BLOCK_SCALE, narrowAmount),
    flatItemSize: mix(FLAT_ITEM_SIZE, NARROW_FLAT_ITEM_SIZE, narrowAmount),
  }
}

const pose = (model: HeldItemModel, aspect: number, swingAmount = 0): void => {
  const layout = getLayout(aspect)
  model.group.position.set(
    layout.x,
    layout.y - swingAmount * SWING_DROP_UNITS,
    layout.z - swingAmount * SWING_FORWARD_UNITS,
  )
  model.group.rotation.set(
    ITEM_ROTATION_X + swingAmount * SWING_PITCH_RADS,
    ITEM_ROTATION_Y + swingAmount * SWING_YAW_RADS,
    ITEM_ROTATION_Z,
  )
  model.mesh.scale.setScalar(model.isBlock ? layout.blockScale : layout.flatItemSize / FLAT_ITEM_SIZE)
}

const applyAtlasUvs = (mesh: THREE.Mesh, tileIndex: number): boolean => {
  const { u0, v0, u1, v1 } = getItemTileUVs(tileIndex)
  const uv = mesh.geometry.attributes['uv']
  /* c8 ignore next -- generated plane and box geometries always contain UVs */
  if (!uv) return false
  for (let base = 0; base + 3 < uv.count; base += 4) {
    uv.setXY(base, u0, v1)
    uv.setXY(base + 1, u1, v1)
    uv.setXY(base + 2, u0, v0)
    uv.setXY(base + 3, u1, v0)
  }
  uv.needsUpdate = true
  return true
}

const createModel = (item: InventoryItem, atlas: THREE.Texture, aspect: number): HeldItemModel | null => {
  const tileIndex = getItemTileIndex(item)
  if (tileIndex < 0) return null
  const isBlock = BLOCK_ITEMS.has(item)
  const geometry = isBlock
    ? new THREE.BoxGeometry(1, 1, 1)
    : new THREE.PlaneGeometry(FLAT_ITEM_SIZE, FLAT_ITEM_SIZE)
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: atlas,
    transparent: !isBlock,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  })
  const mesh = new THREE.Mesh(geometry, material)
  applyAtlasUvs(mesh, tileIndex)
  const group = new THREE.Group()
  group.add(mesh)
  const model = { group, mesh, isBlock }
  pose(model, aspect)
  return model
}

const disposeModel = (model: HeldItemModel): void => {
  model.mesh.geometry.dispose()
  const material = model.mesh.material
  if (Array.isArray(material)) Arr.forEach(material, (entry) => entry.dispose())
  else material.dispose()
}

export const createFirstPersonHeldItemPresenter = (
  rendererService: FirstPersonHeldItemRenderer,
  atlasTexture: THREE.Texture,
  initialWidth = 1,
  initialHeight = 1,
): FirstPersonHeldItemPresenter => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(ITEM_FOV, initialWidth / Math.max(1, initialHeight), ITEM_NEAR, ITEM_FAR)
  let model: HeldItemModel | null = null
  let lastSwingAmount = 0

  const removeModel = (): void => {
    if (model === null) return
    scene.remove(model.group)
    disposeModel(model)
    model = null
  }

  return {
    resize: (width, height) => {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      if (model !== null) pose(model, camera.aspect, lastSwingAmount)
    },
    replace: (selectedItem) => {
      removeModel()
      if (selectedItem === null) return
      model = createModel(selectedItem.item, atlasTexture, camera.aspect)
      lastSwingAmount = 0
      if (model !== null) scene.add(model.group)
    },
    render: (renderer, swingAmount = 0) => {
      if (model === null) return Effect.void
      if (swingAmount !== lastSwingAmount) {
        pose(model, camera.aspect, swingAmount)
        lastSwingAmount = swingAmount
      }
      return rendererService.renderOverlay(renderer, scene, camera)
    },
    dispose: removeModel,
  }
}
