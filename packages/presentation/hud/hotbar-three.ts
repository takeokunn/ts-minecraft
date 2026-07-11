import { Array as Arr, Effect, Option, MutableRef } from 'effect'
import * as THREE from 'three'
import { InventoryItem } from '@ts-minecraft/core'
import { SlotIndex } from '@ts-minecraft/core'
import type { HotbarSlotStack } from '@ts-minecraft/inventory/application/hotbar-service'
import { RendererService, TextureService, getItemTileIndex, getItemTileUVs } from '@ts-minecraft/rendering'
import {
  EMPTY_HOTBAR_VALUES,
  HOTBAR_SLOTS,
  resolveHotbarUpdate,
  type HotbarState,
  type HotbarSlotValue,
} from './hotbar-three-state'
import {
  badgeAnchorY,
  createSlotCountBadge,
  updateSlotCountBadge,
  type SlotCountBadge,
} from './hotbar-count-badge'
import { getHudScale } from './hud-scale'
import { createFirstPersonHeldItemPresenter } from './first-person-held-item'

const SLOT_SIZE = 60
const SLOT_GAP = 10
const SLOT_STRIDE = SLOT_SIZE + SLOT_GAP
const TOTAL_WIDTH = HOTBAR_SLOTS * SLOT_SIZE + (HOTBAR_SLOTS - 1) * SLOT_GAP
const HOTBAR_HORIZONTAL_SAFE_AREA = 16
const HOTBAR_Y_OFFSET = 50 // pixels from bottom edge of viewport to center of hotbar strip
// Vanilla-style slot cell: a dark translucent square framed by a light-grey
// outer border and a darker inner edge. The frame is built from two planes
// sitting *behind* the slot plane — each is slightly larger than the slot so a
// thin ring of it peeks out around the cell (the same peek-behind trick the
// selection highlight uses). Colours mirror the Minecraft widgets texture.
const DEFAULT_TILE_COLOR = 0x000000 // empty-slot fill (dark, translucent below)
const SLOT_OPACITY = 0.55 // rgba(0, 0, 0, 0.55) dark translucent cell
const SLOT_FRAME_COLOR = 0x8b8b8b // 2px outer border ring
const SLOT_INNER_EDGE_COLOR = 0x373737 // 1px inner edge ring
const SLOT_FRAME_OPACITY = 0.9
const SLOT_FRAME_SIZE = SLOT_SIZE + 6 // grey border peeks ~3px around the cell
const SLOT_INNER_EDGE_SIZE = SLOT_SIZE + 2 // dark edge peeks ~1px inside the grey
const SELECTED_SLOT_SCALE = 1.05 // subtle pop; stays inside the grey frame
const SELECTED_BORDER_COLOR = 0xffffff // thick white border that clearly pops
const SELECTED_BORDER_SIZE = SLOT_SIZE + 12
const SELECTED_BORDER_OPACITY = 1
const ITEM_NAME_LABEL_WIDTH = 360
const ITEM_NAME_LABEL_HEIGHT = 48
const ITEM_NAME_LABEL_Y_OFFSET = HOTBAR_Y_OFFSET + 62
const ITEM_NAME_LABEL_DURATION_MS = 1600
const ITEM_NAME_LABEL_FADE_MS = 400

type ItemNameLabel = {
  readonly mesh: THREE.Mesh
  readonly material: THREE.MeshBasicMaterial
  readonly texture: THREE.CanvasTexture
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
}

export type HotbarViewportLayout = {
  readonly zoom: number
  readonly y: number
  readonly itemNameY: number
}

export const resolveHotbarViewportLayout = (
  width: number,
  height: number,
  uiScale: number,
): HotbarViewportLayout => {
  const safeWidth = Math.max(1, width - HOTBAR_HORIZONTAL_SAFE_AREA * 2)
  const requestedScale = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1
  const zoom = Math.min(requestedScale, safeWidth / TOTAL_WIDTH)
  return {
    zoom,
    y: -height / (2 * zoom) + HOTBAR_Y_OFFSET,
    itemNameY: -height / (2 * zoom) + ITEM_NAME_LABEL_Y_OFFSET,
  }
}

const formatInventoryItemName = (item: InventoryItem): string => {
  if (item === 'TNT') return 'TNT'
  return item
    .split('_')
    .map((part) => `${part.charAt(0)}${part.slice(1).toLowerCase()}`)
    .join(' ')
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
      const { hudScene, borderMesh } = yield* Effect.sync(() => {
        const scene = new THREE.Scene()
        const border = new THREE.Mesh(
          new THREE.PlaneGeometry(SELECTED_BORDER_SIZE, SELECTED_BORDER_SIZE),
          new THREE.MeshBasicMaterial({ color: SELECTED_BORDER_COLOR, transparent: true, opacity: SELECTED_BORDER_OPACITY })
        )
        // In front of the grey/inner frames (z 0.35/0.4) but behind the slot
        // cell (z 1): the opaque white plane is hidden by the cell except for
        // the ring peeking beyond it, reading as a clean white outline.
        border.position.z = 0.5
        border.visible = false
        scene.add(border)
        return { hudScene: scene, borderMesh: border }
      })
      const prevStateRef = MutableRef.make<HotbarState>({
        slots: EMPTY_HOTBAR_VALUES,
        selectedIndex: 0,
        selectedItemKey: '',
        hasState: false,
      })

      // Load the shared atlas texture for hotbar item icons
      const atlasTexture = yield* textureService.load('/textures/atlas.png')
      const heldItemPresenter = createFirstPersonHeldItemPresenter(rendererService, atlasTexture)
      const hudCameraRef = MutableRef.make<Option.Option<THREE.OrthographicCamera>>(Option.none())
      const slotMeshesRef = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])
      const countBadgesRef = MutableRef.make<ReadonlyArray<SlotCountBadge>>([])
      // Static per-slot frame planes (grey border + inner edge). They live for
      // the session and only need their y re-anchored on resize.
      const frameMeshesRef = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])
      const itemNameLabelRef = MutableRef.make<Option.Option<ItemNameLabel>>(Option.none())
      const itemNameLabelShownAtMsRef = MutableRef.make(0)
      const viewportWidthRef = MutableRef.make(1)
      const viewportHeightRef = MutableRef.make(1)
      const appliedHudScaleRef = MutableRef.make(Number.NaN)

      const makeCamera = (w: number, h: number): THREE.OrthographicCamera => {
        const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, 100)
        cam.position.z = 10
        return cam
      }

      const applyHotbarViewportLayout = (w: number, h: number): void => {
        MutableRef.set(viewportWidthRef, w)
        MutableRef.set(viewportHeightRef, h)
        const uiScale = getHudScale()
        MutableRef.set(appliedHudScaleRef, uiScale)
        const layout = resolveHotbarViewportLayout(w, h, uiScale)
        const hudCamera = MutableRef.get(hudCameraRef)

        Option.map(hudCamera, (cam) => {
          cam.left = -w / 2
          cam.right = w / 2
          cam.top = h / 2
          cam.bottom = -h / 2
          cam.zoom = layout.zoom
          cam.updateProjectionMatrix()
        })
        Arr.forEach(MutableRef.get(slotMeshesRef), (mesh) => {
          mesh.position.y = layout.y
        })
        Arr.forEach(MutableRef.get(frameMeshesRef), (mesh) => {
          mesh.position.y = layout.y
        })
        Arr.forEach(MutableRef.get(countBadgesRef), (badge) => {
          badge.mesh.position.y = badgeAnchorY(layout.y, SLOT_SIZE)
        })
        borderMesh.position.y = layout.y
        Option.map(MutableRef.get(itemNameLabelRef), (label) => {
          label.mesh.position.y = layout.itemNameY
        })
      }

      // Resize handler — defined here so it can be registered/unregistered via finalizer.
      // Effect.runSync inside a raw DOM callback is intentional: callbacks cannot yield.
      const resizeHandler = () => {
        const w = window.innerWidth
        const h = window.innerHeight
        applyHotbarViewportLayout(w, h)
        heldItemPresenter.resize(w, h)
      }

      const showSelectedItemName = (selectedItem: HotbarSlotValue): void => {
        const label = Option.getOrNull(MutableRef.get(itemNameLabelRef))
        if (label === null) return

        if (selectedItem === null) {
          label.mesh.visible = false
          label.material.opacity = 0
          return
        }

        redrawItemNameLabel(label, selectedItem.item)
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
        heldItemPresenter.dispose()
      }))

      return {
        initialize: (initialWidth: number, initialHeight: number): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cam = makeCamera(initialWidth, initialHeight)
            MutableRef.set(hudCameraRef, Option.some(cam))
            heldItemPresenter.resize(initialWidth, initialHeight)

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
              borderMesh.position.set(0, -initialHeight / 2 + HOTBAR_Y_OFFSET, 0.5)
              const itemNameLabel = createItemNameLabel(initialHeight)
              if (itemNameLabel !== null) {
                hudScene.add(itemNameLabel.mesh)
                MutableRef.set(itemNameLabelRef, Option.some(itemNameLabel))
              }

              // Per-slot frames — created AFTER the label so the earlier
              // THREE.Mesh indices (border #0, slots #1..9, label #10) stay put.
              // Two concentric planes per slot: grey outer border behind a
              // darker inner edge, both behind the slot cell (z 1). Frame draw
              // order is set by z, not creation order, so appending last is safe.
              const y = -initialHeight / 2 + HOTBAR_Y_OFFSET
              const frames = Arr.makeBy(HOTBAR_SLOTS, (i) => {
                const x = -TOTAL_WIDTH / 2 + SLOT_SIZE / 2 + i * SLOT_STRIDE
                const outer = new THREE.Mesh(
                  new THREE.PlaneGeometry(SLOT_FRAME_SIZE, SLOT_FRAME_SIZE),
                  new THREE.MeshBasicMaterial({ color: SLOT_FRAME_COLOR, transparent: true, opacity: SLOT_FRAME_OPACITY }),
                )
                outer.position.set(x, y, 0.35)
                const inner = new THREE.Mesh(
                  new THREE.PlaneGeometry(SLOT_INNER_EDGE_SIZE, SLOT_INNER_EDGE_SIZE),
                  new THREE.MeshBasicMaterial({ color: SLOT_INNER_EDGE_COLOR, transparent: true, opacity: SLOT_FRAME_OPACITY }),
                )
                inner.position.set(x, y, 0.4)
                return [outer, inner] as const
              })
              const frameMeshes = Arr.flatMap(frames, (pair) => pair)
              Arr.forEach(frameMeshes, (m) => {
                hudScene.add(m)
              })
              MutableRef.set(frameMeshesRef, frameMeshes)

              // Stack-count badges: one per slot, above the item tile (z 2).
              const badges: Array<SlotCountBadge> = []
              for (let i = 0; i < HOTBAR_SLOTS; i++) {
                const x = -TOTAL_WIDTH / 2 + SLOT_SIZE / 2 + i * SLOT_STRIDE
                const badge = createSlotCountBadge(x, y, SLOT_SIZE)
                if (badge === null) continue
                hudScene.add(badge.mesh)
                badges.push(badge)
              }
              MutableRef.set(countBadgesRef, badges)
              return built
            })
            MutableRef.set(slotMeshesRef, meshes)
            applyHotbarViewportLayout(initialWidth, initialHeight)
          }),

        update: (slots: ReadonlyArray<Option.Option<HotbarSlotStack>>, selectedSlot: SlotIndex): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const slotMeshes = MutableRef.get(slotMeshesRef)
            const prevState = MutableRef.get(prevStateRef)
            const decision = resolveHotbarUpdate(slots, selectedSlot, prevState)

            if (decision.shouldShowItemName) {
              showSelectedItemName(decision.selectedItem)
            }
            if (decision.heldItemChanged) {
              heldItemPresenter.replace(decision.selectedItem)
            }

            if (decision.unchanged) return

            MutableRef.set(prevStateRef, decision.nextState)

            if (decision.slotsChanged) {
              const countBadges = MutableRef.get(countBadgesRef)
              for (let index = 0; index < slotMeshes.length && index < HOTBAR_SLOTS; index++) {
                const mesh = slotMeshes[index]
                if (mesh === undefined) continue
                const slot = slots[index]
                const badge = countBadges[index]
                if (badge !== undefined) {
                  updateSlotCountBadge(badge, decision.nextState.slots[index] ?? null)
                }
                /* c8 ignore next */
                if (!(mesh.material instanceof THREE.MeshBasicMaterial)) continue
                const mat = mesh.material
                if (slot === undefined || Option.isNone(slot)) {
                  mat.color.setHex(DEFAULT_TILE_COLOR)
                  mat.opacity = SLOT_OPACITY
                  mat.map = null
                  mat.needsUpdate = true
                } else {
                  const itemType = slot.value.itemType
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
              selectedMesh.scale.setScalar(SELECTED_SLOT_SCALE)
              borderMesh.position.x = selectedMesh.position.x
              borderMesh.visible = true
            } else {
              borderMesh.visible = false
            }
          }),

        render: (renderer: THREE.WebGLRenderer, swingAmount = 0): Effect.Effect<void, never> => {
          if (getHudScale() !== MutableRef.get(appliedHudScaleRef)) {
            applyHotbarViewportLayout(
              MutableRef.get(viewportWidthRef),
              MutableRef.get(viewportHeightRef),
            )
          }
          updateItemNameLabelOpacity()
          const hudCamera = Option.getOrNull(MutableRef.get(hudCameraRef))
          if (hudCamera === null) return Effect.void
          return Effect.gen(function* () {
            yield* heldItemPresenter.render(renderer, swingAmount)
            yield* rendererService.renderOverlay(renderer, hudScene, hudCamera)
          })
        },
      }
    }),
  }
) {}
