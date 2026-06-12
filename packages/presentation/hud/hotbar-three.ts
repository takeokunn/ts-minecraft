import { Array as Arr, Effect, Option, Ref, MutableRef } from 'effect'
import * as THREE from 'three'
import { InventoryItem } from '@ts-minecraft/core'
import { RendererService, TextureService, getItemTileIndex, getItemTileUVs } from '@ts-minecraft/rendering'
import { SlotIndex } from '@ts-minecraft/core'

const SLOT_SIZE = 60
const SLOT_GAP = 10
const SLOT_STRIDE = SLOT_SIZE + SLOT_GAP
const HOTBAR_SLOTS = 9
const TOTAL_WIDTH = HOTBAR_SLOTS * SLOT_SIZE + (HOTBAR_SLOTS - 1) * SLOT_GAP
const HOTBAR_Y_OFFSET = 50 // pixels from bottom edge of viewport to center of hotbar strip
const DEFAULT_TILE_COLOR = 0x8a8f96
const SLOT_OPACITY = 0.78
const SELECTED_BORDER_COLOR = 0xfff4b0

const buildSlotsKey = (slots: ReadonlyArray<Option.Option<InventoryItem>>): string =>
  Arr.map(slots, (slot) => Option.getOrElse(slot, () => '_')).join('|')

export class HotbarRendererService extends Effect.Service<HotbarRendererService>()(
  '@minecraft/presentation/HotbarRenderer',
  {
    scoped: Effect.gen(function* () {
      const rendererService = yield* RendererService
      const textureService = yield* TextureService
      const { hudScene, borderMesh } = yield* Effect.sync(() => {
        const scene = new THREE.Scene()
        const border = new THREE.Mesh(
          new THREE.PlaneGeometry(SLOT_SIZE + 8, SLOT_SIZE + 8),
          new THREE.MeshBasicMaterial({ color: SELECTED_BORDER_COLOR, transparent: true, opacity: 0.92 })
        )
        border.position.z = 0
        border.visible = false
        scene.add(border)
        return { hudScene: scene, borderMesh: border }
      })
      const prevStateRef = yield* Ref.make<{ slotsKey: string; selected: SlotIndex }>({ slotsKey: '', selected: SlotIndex.make(0) })

      // Load the shared atlas texture for hotbar item icons
      const atlasTexture = yield* textureService.load('/textures/atlas.png')
      const hudCameraRef = MutableRef.make<Option.Option<THREE.OrthographicCamera>>(Option.none())
      const slotMeshesRef = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])

      const makeCamera = (w: number, h: number): THREE.OrthographicCamera => {
        const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, 100)
        cam.position.z = 10
        return cam
      }

      // Resize handler — defined here so it can be registered/unregistered via finalizer.
      // Effect.runSync inside a raw DOM callback is intentional: callbacks cannot yield.
      const resizeHandler = () => {
        const w = window.innerWidth
        const h = window.innerHeight
        const hudCamera = MutableRef.get(hudCameraRef)
        const slotMeshes = MutableRef.get(slotMeshesRef)

        Option.map(hudCamera, (cam) => {
          cam.left = -w / 2
          cam.right = w / 2
          cam.top = h / 2
          cam.bottom = -h / 2
          cam.updateProjectionMatrix()
        })

        const newY = -h / 2 + HOTBAR_Y_OFFSET
        Arr.forEach(slotMeshes, (m) => {
          m.position.y = newY
        })
        borderMesh.position.y = newY
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
              return built
            })
            MutableRef.set(slotMeshesRef, meshes)
          }),

        update: (slots: ReadonlyArray<Option.Option<InventoryItem>>, selectedSlot: SlotIndex): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const slotMeshes = MutableRef.get(slotMeshesRef)
            const slotsKey = buildSlotsKey(slots)
            const unchanged = yield* Ref.modify(prevStateRef, (prev) => {
              /* c8 ignore next */
              if (prev.selected === selectedSlot && prev.slotsKey === slotsKey) return [true, prev] as const
              return [false, { slotsKey, selected: selectedSlot }] as const
            })

            /* c8 ignore next */
            if (unchanged) return

            Arr.forEach(
              Arr.zip(slotMeshes, slots),
              ([mesh, slot]) => {
                /* c8 ignore next */
                if (!(mesh.material instanceof THREE.MeshBasicMaterial)) return
                const mat = mesh.material
                if (Option.isNone(slot)) {
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
                    const { u0, v0, u1, v1 } = getItemTileUVs(tileIndex)
                    const geo = mesh.geometry
                    const uvAttr = geo.attributes['uv']
                    /* c8 ignore next -- defensive guard; PlaneGeometry always has uv attribute */
                    if (!uvAttr) return
                    // PlaneGeometry UVs: bottom-left, bottom-right, top-left, top-right
                    // Our atlas V is flipped, so swap v0↔v1
                    uvAttr.setXY(0, u0, v1) // bottom-left
                    uvAttr.setXY(1, u1, v1) // bottom-right
                    uvAttr.setXY(2, u0, v0) // top-left
                    uvAttr.setXY(3, u1, v0) // top-right
                    uvAttr.needsUpdate = true
                    mat.color.setHex(0xffffff)
                    mat.opacity = 1.0
                    mat.map = atlasTexture
                    mat.needsUpdate = true
                  }
                }
                mesh.scale.setScalar(1)
              },
            )

            const selectedMesh = Option.getOrNull(Arr.get(slotMeshes, SlotIndex.toNumber(selectedSlot)))
            if (selectedMesh !== null) {
              selectedMesh.scale.setScalar(1.2)
              borderMesh.position.x = selectedMesh.position.x
              borderMesh.visible = true
            } else {
              borderMesh.visible = false
            }
          }),

        render: (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> => {
          const hudCamera = Option.getOrNull(MutableRef.get(hudCameraRef))
          return hudCamera !== null ? rendererService.renderOverlay(renderer, hudScene, hudCamera) : Effect.void
        },
      }
    }),
  }
) {}
export const HotbarRendererLive = HotbarRendererService.Default
