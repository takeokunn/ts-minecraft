import { Array as Arr, Effect, Option, MutableRef } from 'effect'
import * as THREE from 'three'
import { InventoryItem } from '@ts-minecraft/core'
import { SlotIndex } from '@ts-minecraft/core'
import { RendererService, TextureService, getItemTileIndex, getItemTileUVs } from '@ts-minecraft/rendering'
import {
  EMPTY_HOTBAR_VALUES,
  HOTBAR_SLOTS,
  resolveHotbarUpdate,
  type HotbarState,
  type HotbarSlotValue,
} from './hotbar-three-state'

const SLOT_SIZE = 60
const SLOT_GAP = 10
const SLOT_STRIDE = SLOT_SIZE + SLOT_GAP
const TOTAL_WIDTH = HOTBAR_SLOTS * SLOT_SIZE + (HOTBAR_SLOTS - 1) * SLOT_GAP
const HOTBAR_Y_OFFSET = 50 // pixels from bottom edge of viewport to center of hotbar strip
const DEFAULT_TILE_COLOR = 0x8a8f96
const SLOT_OPACITY = 0.78
const SELECTED_BORDER_COLOR = 0xfff4b0
const ITEM_NAME_LABEL_WIDTH = 360
const ITEM_NAME_LABEL_HEIGHT = 48
const ITEM_NAME_LABEL_Y_OFFSET = HOTBAR_Y_OFFSET + 62
const ITEM_NAME_LABEL_DURATION_MS = 1600
const ITEM_NAME_LABEL_FADE_MS = 400
const FIRST_PERSON_ITEM_FOV = 50
const FIRST_PERSON_ITEM_NEAR = 0.1
const FIRST_PERSON_ITEM_FAR = 10
const FIRST_PERSON_ITEM_X = 0.72
const FIRST_PERSON_ITEM_Y = -0.48
const FIRST_PERSON_ITEM_Z = -1.55
const FIRST_PERSON_ITEM_ROTATION_X = -0.32
const FIRST_PERSON_ITEM_ROTATION_Y = -0.54
const FIRST_PERSON_ITEM_ROTATION_Z = -0.16
const FIRST_PERSON_BLOCK_SCALE = 0.42
const FIRST_PERSON_FLAT_ITEM_SIZE = 0.72
const FIRST_PERSON_NARROW_ASPECT = 0.75
const FIRST_PERSON_NARROW_ITEM_X = 0.68
const FIRST_PERSON_NARROW_ITEM_Y = 0.05
const FIRST_PERSON_NARROW_ITEM_Z = -2.2
const FIRST_PERSON_NARROW_BLOCK_SCALE = 0.32
const FIRST_PERSON_NARROW_FLAT_ITEM_SIZE = 0.58

type ItemNameLabel = {
  readonly mesh: THREE.Mesh
  readonly material: THREE.MeshBasicMaterial
  readonly texture: THREE.CanvasTexture
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
}

type FirstPersonHeldItem = {
  readonly group: THREE.Group
  readonly mesh: THREE.Mesh
  readonly isBlock: boolean
}

type FirstPersonLayout = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly blockScale: number
  readonly flatItemSize: number
}

const FIRST_PERSON_BLOCK_ITEMS: ReadonlySet<InventoryItem> = new Set<InventoryItem>([
  'DIRT',
  'STONE',
  'WOOD',
  'GRASS',
  'SAND',
  'WATER',
  'LEAVES',
  'GLASS',
  'SNOW',
  'GRAVEL',
  'COBBLESTONE',
  'GRANITE',
  'DIORITE',
  'ANDESITE',
  'DEEPSLATE',
  'BEDROCK',
  'LAVA',
  'OBSIDIAN',
  'COAL_ORE',
  'IRON_ORE',
  'GOLD_ORE',
  'DIAMOND_ORE',
  'REDSTONE_ORE',
  'LAPIS_ORE',
  'EMERALD_ORE',
  'DEEPSLATE_COAL_ORE',
  'DEEPSLATE_IRON_ORE',
  'DEEPSLATE_GOLD_ORE',
  'DEEPSLATE_DIAMOND_ORE',
  'DEEPSLATE_REDSTONE_ORE',
  'DEEPSLATE_LAPIS_ORE',
  'DEEPSLATE_EMERALD_ORE',
  'COAL_BLOCK',
  'IRON_BLOCK',
  'GOLD_BLOCK',
  'DIAMOND_BLOCK',
  'REDSTONE_BLOCK',
  'LAPIS_BLOCK',
  'EMERALD_BLOCK',
  'PLANKS',
  'CRAFTING_TABLE',
  'FURNACE',
  'TORCH',
  'NETHERRACK',
  'NETHER_PORTAL',
  'FARMLAND',
  'WHEAT_CROP',
  'REDSTONE_WIRE',
  'REDSTONE_TORCH',
  'LEVER',
  'STONE_BUTTON',
  'REPEATER',
  'BED',
  'ENCHANTING_TABLE',
  'END_STONE',
  'END_PORTAL_FRAME',
  'END_PORTAL',
  'CHORUS_FLOWER',
  'CHORUS_PLANT',
  'DRAGON_EGG',
  'END_CRYSTAL',
  'END_GATEWAY',
  'END_ROD',
  'END_STONE_BRICKS',
  'ENDER_CHEST',
  'PURPUR_BLOCK',
  'PURPUR_PILLAR',
  'PURPUR_SLAB',
  'PURPUR_STAIRS',
  'SHULKER_BOX',
  'TNT',
  'CHEST',
  'DOOR',
  'DOOR_OPEN',
  'GLOWSTONE',
  'LADDER',
  'COBWEB',
  'SAPLING',
  'DANDELION',
  'POPPY',
  'BROWN_MUSHROOM',
  'RED_MUSHROOM',
  'TALL_GRASS',
  'FERN',
  'SUGAR_CANE',
  'CACTUS',
  'LILY_PAD',
  'ICE',
])

const formatInventoryItemName = (item: InventoryItem): string => {
  if (item === 'TNT') return 'TNT'
  return item
    .split('_')
    .map((part) => `${part.charAt(0)}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

const isFirstPersonBlockItem = (item: InventoryItem): boolean =>
  FIRST_PERSON_BLOCK_ITEMS.has(item)

const mix = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value))

const getFirstPersonLayout = (aspect: number): FirstPersonLayout => {
  const narrowAmount = clamp01((FIRST_PERSON_NARROW_ASPECT - aspect) / FIRST_PERSON_NARROW_ASPECT)
  return {
    x: mix(FIRST_PERSON_ITEM_X, FIRST_PERSON_NARROW_ITEM_X, narrowAmount),
    y: mix(FIRST_PERSON_ITEM_Y, FIRST_PERSON_NARROW_ITEM_Y, narrowAmount),
    z: mix(FIRST_PERSON_ITEM_Z, FIRST_PERSON_NARROW_ITEM_Z, narrowAmount),
    blockScale: mix(FIRST_PERSON_BLOCK_SCALE, FIRST_PERSON_NARROW_BLOCK_SCALE, narrowAmount),
    flatItemSize: mix(FIRST_PERSON_FLAT_ITEM_SIZE, FIRST_PERSON_NARROW_FLAT_ITEM_SIZE, narrowAmount),
  }
}

const applyFirstPersonHeldItemLayout = (
  heldItem: FirstPersonHeldItem,
  aspect: number,
): void => {
  const layout = getFirstPersonLayout(aspect)
  heldItem.group.position.set(layout.x, layout.y, layout.z)
  heldItem.group.rotation.set(FIRST_PERSON_ITEM_ROTATION_X, FIRST_PERSON_ITEM_ROTATION_Y, FIRST_PERSON_ITEM_ROTATION_Z)
  heldItem.mesh.scale.setScalar(heldItem.isBlock ? layout.blockScale : layout.flatItemSize / FIRST_PERSON_FLAT_ITEM_SIZE)
}

const applyAtlasUvsToMesh = (mesh: THREE.Mesh, tileIndex: number): boolean => {
  const { u0, v0, u1, v1 } = getItemTileUVs(tileIndex)
  const uvAttr = mesh.geometry.attributes['uv']
  /* c8 ignore next -- defensive guard; generated PlaneGeometry/BoxGeometry always has uv attribute */
  if (!uvAttr) return false

  const uvCount = uvAttr.count
  for (let base = 0; base + 3 < uvCount; base += 4) {
    uvAttr.setXY(base, u0, v1)
    uvAttr.setXY(base + 1, u1, v1)
    uvAttr.setXY(base + 2, u0, v0)
    uvAttr.setXY(base + 3, u1, v0)
  }
  uvAttr.needsUpdate = true
  return true
}

const createFirstPersonHeldItem = (
  item: InventoryItem,
  atlasTexture: THREE.Texture,
  aspect: number,
): FirstPersonHeldItem | null => {
  const tileIndex = getItemTileIndex(item)
  if (tileIndex < 0) return null

  const group = new THREE.Group()

  const isBlock = isFirstPersonBlockItem(item)
  const geometry = isBlock
    ? new THREE.BoxGeometry(1, 1, 1)
    : new THREE.PlaneGeometry(FIRST_PERSON_FLAT_ITEM_SIZE, FIRST_PERSON_FLAT_ITEM_SIZE)
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: atlasTexture,
    transparent: !isBlock,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  applyAtlasUvsToMesh(mesh, tileIndex)
  group.add(mesh)

  const heldItem = { group, mesh, isBlock }
  applyFirstPersonHeldItemLayout(heldItem, aspect)
  return heldItem
}

const disposeFirstPersonHeldItem = (heldItem: FirstPersonHeldItem): void => {
  heldItem.mesh.geometry.dispose()
  const material = heldItem.mesh.material
  if (Array.isArray(material)) {
    Arr.forEach(material, (entry) => entry.dispose())
  } else {
    material.dispose()
  }
}

const createItemNameLabel = (initialHeight: number): ItemNameLabel | null => {
  /* c8 ignore next -- browser runtime always provides document */
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = ITEM_NAME_LABEL_WIDTH * 2
  canvas.height = ITEM_NAME_LABEL_HEIGHT * 2
  const context = canvas.getContext('2d')
  if (context === null) return null

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
  })
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ITEM_NAME_LABEL_WIDTH, ITEM_NAME_LABEL_HEIGHT),
    material,
  )
  mesh.position.set(0, -initialHeight / 2 + ITEM_NAME_LABEL_Y_OFFSET, 2)
  mesh.visible = false

  return { mesh, material, texture, canvas, context }
}

const redrawItemNameLabel = (label: ItemNameLabel, item: InventoryItem): void => {
  const { canvas, context, texture } = label
  const text = formatInventoryItemName(item)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.font = 'bold 40px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = 8
  context.strokeStyle = 'rgba(0, 0, 0, 0.85)'
  context.fillStyle = 'rgba(255, 255, 255, 0.96)'
  context.strokeText(text, canvas.width / 2, canvas.height / 2)
  context.fillText(text, canvas.width / 2, canvas.height / 2)
  context.restore()
  texture.needsUpdate = true
}

export class HotbarRendererService extends Effect.Service<HotbarRendererService>()(
  '@minecraft/presentation/HotbarRenderer',
  {
    scoped: Effect.gen(function* () {
      const rendererService = yield* RendererService
      const textureService = yield* TextureService
      const { hudScene, heldItemScene, borderMesh } = yield* Effect.sync(() => {
        const scene = new THREE.Scene()
        const firstPersonScene = new THREE.Scene()
        const border = new THREE.Mesh(
          new THREE.PlaneGeometry(SLOT_SIZE + 8, SLOT_SIZE + 8),
          new THREE.MeshBasicMaterial({ color: SELECTED_BORDER_COLOR, transparent: true, opacity: 0.92 })
        )
        border.position.z = 0
        border.visible = false
        scene.add(border)
        return { hudScene: scene, heldItemScene: firstPersonScene, borderMesh: border }
      })
      const prevStateRef = MutableRef.make<HotbarState>({
        slots: EMPTY_HOTBAR_VALUES,
        selectedIndex: 0,
        selectedItemKey: '',
        hasState: false,
      })

      // Load the shared atlas texture for hotbar item icons
      const atlasTexture = yield* textureService.load('/textures/atlas.png')
      const hudCameraRef = MutableRef.make<Option.Option<THREE.OrthographicCamera>>(Option.none())
      const heldItemCameraRef = MutableRef.make<Option.Option<THREE.PerspectiveCamera>>(Option.none())
      const slotMeshesRef = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])
      const heldItemRef = MutableRef.make<Option.Option<FirstPersonHeldItem>>(Option.none())
      const itemNameLabelRef = MutableRef.make<Option.Option<ItemNameLabel>>(Option.none())
      const itemNameLabelShownAtMsRef = MutableRef.make(0)

      const makeCamera = (w: number, h: number): THREE.OrthographicCamera => {
        const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, 100)
        cam.position.z = 10
        return cam
      }

      const makeHeldItemCamera = (w: number, h: number): THREE.PerspectiveCamera => {
        const cam = new THREE.PerspectiveCamera(
          FIRST_PERSON_ITEM_FOV,
          w / Math.max(1, h),
          FIRST_PERSON_ITEM_NEAR,
          FIRST_PERSON_ITEM_FAR,
        )
        cam.position.z = 0
        return cam
      }

      const replaceHeldItemModel = (selectedItem: HotbarSlotValue): void => {
        const currentHeldItem = Option.getOrNull(MutableRef.get(heldItemRef))
        if (currentHeldItem !== null) {
          heldItemScene.remove(currentHeldItem.group)
          disposeFirstPersonHeldItem(currentHeldItem)
          MutableRef.set(heldItemRef, Option.none())
        }

        if (selectedItem === null) return

        const heldItemCamera = Option.getOrNull(MutableRef.get(heldItemCameraRef))
        const nextHeldItem = createFirstPersonHeldItem(selectedItem, atlasTexture, heldItemCamera?.aspect ?? 1)
        if (nextHeldItem === null) return

        heldItemScene.add(nextHeldItem.group)
        MutableRef.set(heldItemRef, Option.some(nextHeldItem))
      }

      // Resize handler — defined here so it can be registered/unregistered via finalizer.
      // Effect.runSync inside a raw DOM callback is intentional: callbacks cannot yield.
      const resizeHandler = () => {
        const w = window.innerWidth
        const h = window.innerHeight
        const hudCamera = MutableRef.get(hudCameraRef)
        const heldItemCamera = MutableRef.get(heldItemCameraRef)
        const slotMeshes = MutableRef.get(slotMeshesRef)

        Option.map(hudCamera, (cam) => {
          cam.left = -w / 2
          cam.right = w / 2
          cam.top = h / 2
          cam.bottom = -h / 2
          cam.updateProjectionMatrix()
        })
        Option.map(heldItemCamera, (cam) => {
          cam.aspect = w / Math.max(1, h)
          cam.updateProjectionMatrix()
          Option.map(MutableRef.get(heldItemRef), (heldItem) => {
            applyFirstPersonHeldItemLayout(heldItem, cam.aspect)
          })
        })

        const newY = -h / 2 + HOTBAR_Y_OFFSET
        Arr.forEach(slotMeshes, (m) => {
          m.position.y = newY
        })
        borderMesh.position.y = newY
        Option.map(MutableRef.get(itemNameLabelRef), (label) => {
          label.mesh.position.y = -h / 2 + ITEM_NAME_LABEL_Y_OFFSET
        })
      }

      const showSelectedItemName = (selectedItem: HotbarSlotValue): void => {
        const label = Option.getOrNull(MutableRef.get(itemNameLabelRef))
        if (label === null) return

        if (selectedItem === null) {
          label.mesh.visible = false
          label.material.opacity = 0
          return
        }

        redrawItemNameLabel(label, selectedItem)
        MutableRef.set(itemNameLabelShownAtMsRef, Date.now())
        label.material.opacity = 1
        label.mesh.visible = true
      }

      const updateItemNameLabelOpacity = (): void => {
        const label = Option.getOrNull(MutableRef.get(itemNameLabelRef))
        if (label === null || !label.mesh.visible) return

        const elapsedMs = Date.now() - MutableRef.get(itemNameLabelShownAtMsRef)
        if (elapsedMs >= ITEM_NAME_LABEL_DURATION_MS) {
          label.material.opacity = 0
          label.mesh.visible = false
          return
        }

        const fadeStartMs = ITEM_NAME_LABEL_DURATION_MS - ITEM_NAME_LABEL_FADE_MS
        label.material.opacity = elapsedMs <= fadeStartMs
          ? 1
          : Math.max(0, (ITEM_NAME_LABEL_DURATION_MS - elapsedMs) / ITEM_NAME_LABEL_FADE_MS)
      }

      yield* Effect.sync(() => {
        window.addEventListener('resize', resizeHandler)
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        window.removeEventListener('resize', resizeHandler)
      }))

      return {
        initialize: (initialWidth: number, initialHeight: number): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cam = makeCamera(initialWidth, initialHeight)
            MutableRef.set(hudCameraRef, Option.some(cam))
            MutableRef.set(heldItemCameraRef, Option.some(makeHeldItemCamera(initialWidth, initialHeight)))

            const meshes = yield* Effect.sync(() => {
              const built = Arr.makeBy(HOTBAR_SLOTS, (i) => {
                const geo = new THREE.PlaneGeometry(SLOT_SIZE, SLOT_SIZE)
                const mat = new THREE.MeshBasicMaterial({
                  color: DEFAULT_TILE_COLOR,
                  transparent: true,
                  opacity: SLOT_OPACITY,
                  map: atlasTexture,
                })
                const mesh = new THREE.Mesh(geo, mat)
                const x = -TOTAL_WIDTH / 2 + SLOT_SIZE / 2 + i * SLOT_STRIDE
                const y = -initialHeight / 2 + HOTBAR_Y_OFFSET
                mesh.position.set(x, y, 1)
                return mesh
              })
              Arr.forEach(built, (m) => {
                hudScene.add(m)
              })
              borderMesh.position.set(0, -initialHeight / 2 + HOTBAR_Y_OFFSET, 0)
              const itemNameLabel = createItemNameLabel(initialHeight)
              if (itemNameLabel !== null) {
                hudScene.add(itemNameLabel.mesh)
                MutableRef.set(itemNameLabelRef, Option.some(itemNameLabel))
              }
              return built
            })
            MutableRef.set(slotMeshesRef, meshes)
          }),

        update: (slots: ReadonlyArray<Option.Option<InventoryItem>>, selectedSlot: SlotIndex): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const slotMeshes = MutableRef.get(slotMeshesRef)
            const prevState = MutableRef.get(prevStateRef)
            const decision = resolveHotbarUpdate(slots, selectedSlot, prevState)

            if (decision.shouldShowItemName) {
              showSelectedItemName(decision.selectedItem)
            }
            if (decision.heldItemChanged) {
              replaceHeldItemModel(decision.selectedItem)
            }

            if (decision.unchanged) return

            MutableRef.set(prevStateRef, decision.nextState)

            if (decision.slotsChanged) {
              for (let index = 0; index < slotMeshes.length && index < HOTBAR_SLOTS; index++) {
                const mesh = slotMeshes[index]
                if (mesh === undefined) continue
                const slot = slots[index]
                /* c8 ignore next */
                if (!(mesh.material instanceof THREE.MeshBasicMaterial)) continue
                const mat = mesh.material
                if (slot === undefined || Option.isNone(slot)) {
                  mat.color.setHex(DEFAULT_TILE_COLOR)
                  mat.opacity = SLOT_OPACITY
                  mat.map = null
                  mat.needsUpdate = true
                } else {
                  const itemType = slot.value
                  const tileIndex = getItemTileIndex(itemType)
                  if (tileIndex < 0) {
                    mat.color.setHex(DEFAULT_TILE_COLOR)
                    mat.opacity = SLOT_OPACITY
                    mat.map = null
                    mat.needsUpdate = true
                  } else {
                    if (!applyAtlasUvsToMesh(mesh, tileIndex)) continue
                    mat.color.setHex(0xffffff)
                    mat.opacity = 1.0
                    mat.map = atlasTexture
                    mat.needsUpdate = true
                  }
                }
                mesh.scale.setScalar(1)
              }
            } else {
              slotMeshes[prevState.selectedIndex]?.scale.setScalar(1)
            }

            const selectedMesh = slotMeshes[decision.selectedIndex] ?? null
            if (selectedMesh !== null) {
              selectedMesh.scale.setScalar(1.2)
              borderMesh.position.x = selectedMesh.position.x
              borderMesh.visible = true
            } else {
              borderMesh.visible = false
            }
          }),

        render: (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> => {
          updateItemNameLabelOpacity()
          const hudCamera = Option.getOrNull(MutableRef.get(hudCameraRef))
          const heldItemCamera = Option.getOrNull(MutableRef.get(heldItemCameraRef))
          const heldItem = Option.getOrNull(MutableRef.get(heldItemRef))
          if (hudCamera === null) return Effect.void
          return Effect.gen(function* () {
            if (heldItemCamera !== null && heldItem !== null) {
              yield* rendererService.renderOverlay(renderer, heldItemScene, heldItemCamera)
            }
            yield* rendererService.renderOverlay(renderer, hudScene, hudCamera)
          })
        },
      }
    }),
  }
) {}
