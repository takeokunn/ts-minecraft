import { Effect, Option, Ref } from 'effect'
import * as THREE from 'three'

import type { DroppedXpOrbEntity } from '@ts-minecraft/entity/domain/dropped-xp-orb'

import { SceneService } from '../scene/scene-service'

type TrackedDroppedXpOrb = {
  readonly group: THREE.Group
  readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  readonly glow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
}

const createDroppedXpOrbGroup = (orb: DroppedXpOrbEntity): TrackedDroppedXpOrb => {
  const group = new THREE.Group()
  group.name = `dropped-xp-orb:${orb.id}`

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0x56ff7a,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  )
  glow.name = `dropped-xp-orb-glow:${orb.id}`
  glow.renderOrder = 1

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xd7ff4f,
      transparent: true,
      opacity: 0.95,
    }),
  )
  core.name = `dropped-xp-orb-core:${orb.id}`
  core.renderOrder = 2

  group.add(glow)
  group.add(core)

  return { group, core, glow }
}

const updateDroppedXpOrbTransform = (
  tracked: TrackedDroppedXpOrb,
  orb: DroppedXpOrbEntity,
  totalTimeSecs: number,
): void => {
  const bob = Math.sin(totalTimeSecs * 5 + orb.ageTicks * 0.11) * 0.06
  const pulse = 1 + Math.sin(totalTimeSecs * 7 + orb.ageTicks * 0.15) * 0.12
  const amountScale = Math.min(1.8, 0.85 + Math.sqrt(Math.max(1, orb.amount)) * 0.08)

  tracked.group.position.set(orb.position.x, orb.position.y + 0.35 + bob, orb.position.z)
  tracked.group.rotation.y = totalTimeSecs * 3 + orb.ageTicks * 0.04
  tracked.group.scale.setScalar(amountScale * pulse)
  tracked.glow.material.opacity = 0.22 + (pulse - 0.88) * 0.25
}

const disposeTracked = (tracked: TrackedDroppedXpOrb): void => {
  tracked.core.geometry.dispose()
  tracked.core.material.dispose()
  tracked.glow.geometry.dispose()
  tracked.glow.material.dispose()
}

export class DroppedXpOrbRendererService extends Effect.Service<DroppedXpOrbRendererService>()(
  '@minecraft/rendering/DroppedXpOrbRendererService',
  {
    effect: Effect.gen(function* () {
      const sceneService = yield* SceneService
      const trackedRef = yield* Ref.make<ReadonlyMap<string, TrackedDroppedXpOrb>>(new Map())

      const clearScene = (scene: THREE.Scene): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const trackedOrbs = yield* Ref.get(trackedRef)
          for (const tracked of trackedOrbs.values()) {
            yield* sceneService.remove(scene, tracked.group)
            disposeTracked(tracked)
          }
          yield* Ref.set(trackedRef, new Map())
        })

      return {
        syncOrbs: (
          orbs: ReadonlyArray<DroppedXpOrbEntity>,
          scene: THREE.Scene,
          totalTimeSecs: number,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const current = yield* Ref.get(trackedRef)
            const next = new Map(current)
            const liveIds = new Set(orbs.map((orb) => orb.id))

            for (const [id, tracked] of current) {
              if (!liveIds.has(id)) {
                yield* sceneService.remove(scene, tracked.group)
                disposeTracked(tracked)
                next.delete(id)
              }
            }

            for (const orb of orbs) {
              let tracked = next.get(orb.id)
              if (tracked === undefined) {
                tracked = createDroppedXpOrbGroup(orb)
                next.set(orb.id, tracked)
                yield* sceneService.add(scene, tracked.group)
              }
              updateDroppedXpOrbTransform(tracked, orb, totalTimeSecs)
            }

            yield* Ref.set(trackedRef, next)
          }),

        clearScene,

        _getTrackedGroup: (id: string): Effect.Effect<Option.Option<THREE.Group>, never> =>
          Effect.map(Ref.get(trackedRef), (trackedOrbs) =>
            Option.fromNullable(trackedOrbs.get(id)?.group),
          ),
      }
    }),
  },
) {}
