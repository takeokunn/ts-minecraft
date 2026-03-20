import { Effect, Option, Ref } from 'effect'
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
    scoped: Effect.gen(function* () {
      const rendererService = yield* RendererService

      const hudScene = new THREE.Scene()
      const hudCameraRef = yield* Ref.make<Option.Option<THREE.OrthographicCamera>>(Option.none())

      const slotMeshes: THREE.Mesh[] = []

      const borderMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(SLOT_SIZE + 8, SLOT_SIZE + 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      )
      borderMesh.position.z = 0
      borderMesh.visible = false
      hudScene.add(borderMesh)

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
        const hudCameraOpt = Effect.runSync(Ref.get(hudCameraRef))
        const hudCamera = Option.getOrNull(hudCameraOpt)
        if (hudCamera) {
          hudCamera.left = -w / 2
          hudCamera.right = w / 2
          hudCamera.top = h / 2
          hudCamera.bottom = -h / 2
          hudCamera.updateProjectionMatrix()
        }
        const newY = -h / 2 + HOTBAR_Y_OFFSET
        for (let i = 0; i < slotMeshes.length; i++) {
          const m = slotMeshes[i]
          if (m) m.position.y = newY
        }
        borderMesh.position.y = newY
      }

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          window.addEventListener('resize', resizeHandler)
        }),
        () =>
          Effect.sync(() => {
            window.removeEventListener('resize', resizeHandler)
          }),
      )

      return {
        /**
         * Create HUD scene, camera, and slot meshes. Call once after renderer is created.
         */
        initialize: (initialWidth: number, initialHeight: number): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cam = makeCamera(initialWidth, initialHeight)
            yield* Ref.set(hudCameraRef, Option.some(cam))

            for (let i = 0; i < HOTBAR_SLOTS; i++) {
              const geo = new THREE.PlaneGeometry(SLOT_SIZE, SLOT_SIZE)
              const mat = new THREE.MeshBasicMaterial({ color: BLOCK_COLORS['AIR'] })
              const mesh = new THREE.Mesh(geo, mat)

              const x = -TOTAL_WIDTH / 2 + SLOT_SIZE / 2 + i * SLOT_STRIDE
              const y = -initialHeight / 2 + HOTBAR_Y_OFFSET
              mesh.position.set(x, y, 1)

              slotMeshes.push(mesh)
              hudScene.add(mesh)
            }

            const initialY = -initialHeight / 2 + HOTBAR_Y_OFFSET
            borderMesh.position.set(0, initialY, 0)
          }),

        /**
         * Update slot colors and highlight based on current slots and selected slot. Call every frame.
         */
        update: (slots: ReadonlyArray<Option.Option<BlockType>>, selectedSlot: SlotIndex): Effect.Effect<void, never> =>
          Effect.sync(() => {
            for (let i = 0; i < HOTBAR_SLOTS; i++) {
              const mesh = slotMeshes[i]
              const slot = slots[i]
              if (mesh && slot !== undefined) {
                const mat = mesh.material as THREE.MeshBasicMaterial
                if (Option.isSome(slot)) {
                  mat.color.setHex(BLOCK_COLORS[slot.value])
                } else {
                  mat.color.setHex(0x333333)
                }
                mesh.scale.setScalar(1)
              }
            }

            const activeMesh = slotMeshes[SlotIndex.toNumber(selectedSlot)]
            if (activeMesh) {
              activeMesh.scale.setScalar(1.2)
              borderMesh.position.x = activeMesh.position.x
              borderMesh.visible = true
            } else {
              borderMesh.visible = false
            }
          }),

        /**
         * Render the HUD overlay onto the renderer. Call after main scene render with autoClear=false.
         */
        render: (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const hudCameraOpt = yield* Ref.get(hudCameraRef)
            if (Option.isNone(hudCameraOpt)) return
            yield* rendererService.renderOverlay(renderer, hudScene, hudCameraOpt.value)
          }),
      }
    }),
  }
) {}
export const HotbarRendererLive = HotbarRendererService.Default
