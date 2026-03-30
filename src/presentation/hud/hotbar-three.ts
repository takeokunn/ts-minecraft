import { Array as Arr, Effect, Option, Ref, MutableRef } from 'effect'
import * as THREE from 'three'
import { BlockType } from '@/domain/block'
import { RendererService } from '@/infrastructure/three/renderer/renderer-service'
import { SlotIndex } from '@/shared/kernel'

const BLOCK_COLORS: Record<BlockType, number> = {
  AIR:    0x444444,
  GRASS:  0x5a8a3a,
  DIRT:   0x8b6344,
  STONE:  0x888888,
  SAND:   0xd4c77a,
  WATER:  0x3f76be,
  WOOD:   0x6b4423,
  LEAVES: 0x2d5a1b,
  GLASS:       0xc0e0f0,
  SNOW:        0xf0f5ff,
  GRAVEL:      0x7a6a5a,
  COBBLESTONE: 0x606060,
}

const SLOT_SIZE = 60
const SLOT_GAP = 10
const SLOT_STRIDE = SLOT_SIZE + SLOT_GAP
const HOTBAR_SLOTS = 9
const TOTAL_WIDTH = HOTBAR_SLOTS * SLOT_SIZE + (HOTBAR_SLOTS - 1) * SLOT_GAP
const HOTBAR_Y_OFFSET = 50 // pixels from bottom edge of viewport to center of hotbar strip

export class HotbarRendererService extends Effect.Service<HotbarRendererService>()(
  '@minecraft/presentation/HotbarRenderer',
  {
    scoped: Effect.all([
      RendererService,
      Effect.sync(() => {
        const scene = new THREE.Scene()
        const border = new THREE.Mesh(
          new THREE.PlaneGeometry(SLOT_SIZE + 8, SLOT_SIZE + 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        )
        border.position.z = 0
        border.visible = false
        scene.add(border)
        return { hudScene: scene, borderMesh: border }
      }),
      Ref.make<{ slots: ReadonlyArray<Option.Option<BlockType>>; selected: SlotIndex }>({ slots: [], selected: SlotIndex.make(0) }),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([rendererService, { hudScene, borderMesh }, prevStateRef]) =>
        Effect.gen(function* () {
          const hudCameraRef = MutableRef.make<Option.Option<THREE.OrthographicCamera>>(Option.none())
          const slotMeshesRef = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])

          const makeCamera = (w: number, h: number): THREE.OrthographicCamera => {
            const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0, 100)
            cam.position.z = 10
            return cam
          }

          // Resize handler — defined here so it can be registered/unregistered in acquireRelease.
          // Effect.runSync inside a raw DOM callback is intentional: callbacks cannot yield.
          const resizeHandler = () => {
            const w = window.innerWidth
            const h = window.innerHeight
            const hudCamera = MutableRef.get(hudCameraRef)
            const slotMeshes = MutableRef.get(slotMeshesRef)

            Option.match(hudCamera, {
              onSome: (cam) => {
                cam.left = -w / 2
                cam.right = w / 2
                cam.top = h / 2
                cam.bottom = -h / 2
                cam.updateProjectionMatrix()
              },
              onNone: () => {},
            })

            const newY = -h / 2 + HOTBAR_Y_OFFSET
            Arr.forEach(slotMeshes, (m) => {
              m.position.y = newY
            })
            borderMesh.position.y = newY
          }

          return yield* Effect.acquireRelease(
            Effect.sync(() => {
              window.addEventListener('resize', resizeHandler)
            }),
            () =>
              Effect.sync(() => {
                window.removeEventListener('resize', resizeHandler)
              }),
          ).pipe(
            Effect.as({
              /**
               * Create HUD scene, camera, and slot meshes. Call once after renderer is created.
               */
              initialize: (initialWidth: number, initialHeight: number): Effect.Effect<void, never> =>
                Effect.gen(function* () {
                  const cam = makeCamera(initialWidth, initialHeight)
                  MutableRef.set(hudCameraRef, Option.some(cam))

                  const meshes = yield* Effect.sync(() => {
                    const built = Arr.makeBy(HOTBAR_SLOTS, (i) => {
                      const geo = new THREE.PlaneGeometry(SLOT_SIZE, SLOT_SIZE)
                      const mat = new THREE.MeshBasicMaterial({ color: BLOCK_COLORS.AIR })
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

              /**
               * Update slot colors and highlight based on current slots and selected slot. Call every frame.
               */
              update: (slots: ReadonlyArray<Option.Option<BlockType>>, selectedSlot: SlotIndex): Effect.Effect<void, never> =>
                Effect.gen(function* () {
                  const slotMeshes = MutableRef.get(slotMeshesRef)
                  const unchanged = yield* Ref.modify(prevStateRef, (prev) => {
                    if (prev.selected === selectedSlot && prev.slots === slots) return [true, prev] as const
                    return [false, { slots, selected: selectedSlot }] as const
                  })

                  if (unchanged) return

                  Arr.forEach(
                    Arr.zip(slotMeshes, slots),
                    ([mesh, slot]) => {
                      if (!(mesh.material instanceof THREE.MeshBasicMaterial)) return
                      const mat = mesh.material
                      Option.match(slot, {
                        onSome: (blockType) => {
                          mat.color.setHex(BLOCK_COLORS[blockType])
                        },
                        onNone: () => {
                          mat.color.setHex(0x333333)
                        },
                      })
                      mesh.scale.setScalar(1)
                    },
                  )

                  Option.match(Arr.get(slotMeshes, SlotIndex.toNumber(selectedSlot)), {
                    onSome: (m) => {
                      m.scale.setScalar(1.2)
                      borderMesh.position.x = m.position.x
                      borderMesh.visible = true
                    },
                    onNone: () => {
                      borderMesh.visible = false
                    },
                  })
                }),

              /**
               * Render the HUD overlay onto the renderer. Call after main scene render with autoClear=false.
               */
              render: (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
                Option.match(MutableRef.get(hudCameraRef), {
                  onNone: () => Effect.void,
                  onSome: (cam) => rendererService.renderOverlay(renderer, hudScene, cam),
                }),
            }),
          )
        }),
      ),
    ),
  }
) {}
export const HotbarRendererLive = HotbarRendererService.Default
