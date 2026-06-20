import * as THREE from 'three'
import type { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { MutableHashMap, Option } from 'effect'
import { getRoleSpec, type Dim3, type PartRole, type RolePivot, type RoleSpec } from './entity-instance-specs'
export { getRoleSpec, ROLES_BY_TYPE } from './entity-instance-specs'
export type { PartRole, RoleSpec } from './entity-instance-specs'

// FR-2.5: per (mobType, partKey) InstancedMesh pool. Replaces the previous
// 6-meshes-per-mob THREE.Group approach (~7 draw calls/mob) with a fixed set
// of InstancedMeshes — at most 24 buckets (4 entity types × 6 roles) regardless
// of how many mobs are alive. Drawcalls scale with active bucket count, NOT
// mob count, so 30 mobs = 24 draw calls (was 180-210 in the per-mob
// Group path).

// Hard cap per bucket. We never grow — if a bucket fills, additional mobs of
// that (type, part) combo are silently dropped from rendering. With 30-mob
// caps in the entity manager this is comfortably above the working set.
export const MAX_INSTANCES_PER_TYPE = 256


// ---------------------------------------------------------------------------
// Bucket: one InstancedMesh + slot allocator. Slot 0..count-1 are active;
// count..MAX-1 are free. Removal swaps the removed slot with `count-1` to keep
// the active prefix packed (so InstancedMesh.count can shrink without holes).
// ---------------------------------------------------------------------------

export type BucketKey = `${EntityType}:${PartRole}`

type Bucket = {
  readonly mesh: THREE.InstancedMesh
  readonly geometry: THREE.BoxGeometry
  readonly material: THREE.MeshStandardMaterial
  readonly spec: RoleSpec
  // entityId at each active slot index. The active prefix is always packed.
  readonly slotEntities: string[]
  count: number
}

const makeBucketKey = (type: EntityType, role: PartRole): BucketKey =>
  `${type}:${role}` as BucketKey

const buildBucketGeometry = (size: Dim3, pivot: RolePivot): THREE.BoxGeometry => {
  const [w, h, d] = size
  const g = new THREE.BoxGeometry(w, h, d)
  if (pivot === 'top') g.translate(0, -h / 2, 0)
  return g
}

export type EntityInstancePool = {
  // Idempotent: returns existing bucket if present, else creates and adds it
  // to the scene.
  readonly ensureBucket: (
    scene: THREE.Scene,
    type: EntityType,
    role: PartRole,
  ) => Option.Option<Bucket>
  // Allocates a slot for `entityId` in the (type, role) bucket; returns the
  // slot index, or None when the bucket is saturated.
  readonly allocateSlot: (
    scene: THREE.Scene,
    type: EntityType,
    role: PartRole,
    entityId: string,
  ) => Option.Option<number>
  // Frees the entity's slot in the (type, role) bucket via swap-with-last.
  // No-op if the entity has no slot in this bucket.
  readonly releaseSlot: (
    type: EntityType,
    role: PartRole,
    entityId: string,
  ) => void
  // Writes the per-instance world matrix at `slot`.
  readonly setMatrixAt: (
    type: EntityType,
    role: PartRole,
    slot: number,
    matrix: THREE.Matrix4,
  ) => void
  // Writes the per-instance tint at `slot`.
  readonly setColorAt: (
    type: EntityType,
    role: PartRole,
    slot: number,
    color: number,
  ) => void
  // Marks every bucket's instanceMatrix as needing GPU upload. Call once per
  // frame after all setMatrixAt writes.
  readonly flushAll: () => void
  // Returns a (read-only) view into all live buckets — used by tests + future
  // frustum culling integration.
  readonly getBuckets: () => ReadonlyArray<Bucket>
  // Removes every bucket from the scene and releases GPU resources. Used by
  // EntityRendererService.clearScene + on session teardown.
  readonly disposeAll: (scene: THREE.Scene) => void
  // Lookup helper for the renderer: which (slot, spec) does this entity occupy
  // for this (type, role)?
  readonly getSlot: (
    type: EntityType,
    role: PartRole,
    entityId: string,
  ) => Option.Option<{ readonly slot: number; readonly bucket: Bucket }>
}

export const createEntityInstancePool = (): EntityInstancePool => {
  const buckets = MutableHashMap.empty<BucketKey, Bucket>()
  // Per-bucket entityId → slot index. Lookup avoids scanning slotEntities.
  const slotIndex = MutableHashMap.empty<BucketKey, MutableHashMap.MutableHashMap<string, number>>()
  const swapMatrix = new THREE.Matrix4()
  const scratchColor = new THREE.Color()
  const swapColor = new THREE.Color()

  const ensureBucket = (
    scene: THREE.Scene,
    type: EntityType,
    role: PartRole,
  ): Option.Option<Bucket> => {
    const spec = Option.getOrNull(getRoleSpec(type, role))
    if (spec === null) return Option.none()
    const key = makeBucketKey(type, role)
    const cached = Option.getOrNull(MutableHashMap.get(buckets, key))
    if (cached !== null) return Option.some(cached)
    const geometry = buildBucketGeometry(spec.size, spec.pivot)
    const material = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.12,
      roughness: 0.9,
      metalness: 0.0,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_TYPE)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.count = 0 // start empty; grows as slots are allocated
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = true // bucket-level culling matches FR-2.5 design
    scene.add(mesh)
    const bucket: Bucket = {
      mesh,
      geometry,
      material,
      spec,
      slotEntities: [],
      count: 0,
    }
    MutableHashMap.set(buckets, key, bucket)
    MutableHashMap.set(slotIndex, key, MutableHashMap.empty<string, number>())
    return Option.some(bucket)
  }

  const allocateSlot = (
    scene: THREE.Scene,
    type: EntityType,
    role: PartRole,
    entityId: string,
  ): Option.Option<number> => {
    const bucket = Option.getOrNull(ensureBucket(scene, type, role))
    if (bucket === null) return Option.none()
    if (bucket.count >= MAX_INSTANCES_PER_TYPE) return Option.none()
    const slot = bucket.count
    bucket.slotEntities[slot] = entityId
    bucket.count = slot + 1
    bucket.mesh.count = bucket.count
    bucket.mesh.setColorAt(slot, scratchColor.setHex(bucket.spec.color))
    if (bucket.mesh.instanceColor !== null) bucket.mesh.instanceColor.needsUpdate = true
    const key = makeBucketKey(type, role)
    const existingIdx = Option.getOrNull(MutableHashMap.get(slotIndex, key))
    if (existingIdx !== null) {
      MutableHashMap.set(existingIdx, entityId, slot)
    } else {
      /* c8 ignore start -- first-time bucket creation for a type/role pair; only runs once per new combination */
      const idx = MutableHashMap.empty<string, number>()
      MutableHashMap.set(idx, entityId, slot)
      MutableHashMap.set(slotIndex, key, idx)
      /* c8 ignore end */
    }
    return Option.some(slot)
  }

  const releaseSlot = (
    type: EntityType,
    role: PartRole,
    entityId: string,
  ): void => {
    const key = makeBucketKey(type, role)
    const bucket = Option.getOrNull(MutableHashMap.get(buckets, key))
    const idx = Option.getOrNull(MutableHashMap.get(slotIndex, key))
    if (bucket === null || idx === null) return
    const slot = Option.getOrNull(MutableHashMap.get(idx, entityId))
    if (slot === null) return
    const last = bucket.count - 1
    if (slot !== last) {
      // Swap last → slot: copy matrix from `last`, update bookkeeping.
      const movedEntity = bucket.slotEntities[last]
      bucket.mesh.getMatrixAt(last, swapMatrix)
      bucket.mesh.setMatrixAt(slot, swapMatrix)
      if (bucket.mesh.instanceColor !== null) {
        bucket.mesh.getColorAt(last, swapColor)
        bucket.mesh.setColorAt(slot, swapColor)
        bucket.mesh.instanceColor.needsUpdate = true
      }
      bucket.slotEntities[slot] = movedEntity!
      MutableHashMap.set(idx, movedEntity!, slot)
    }
    bucket.slotEntities.length = last
    bucket.count = last
    bucket.mesh.count = last
    MutableHashMap.remove(idx, entityId)
    bucket.mesh.instanceMatrix.needsUpdate = true
  }

  const setMatrixAt = (
    type: EntityType,
    role: PartRole,
    slot: number,
    matrix: THREE.Matrix4,
  ): void => {
    const key = makeBucketKey(type, role)
    const b = Option.getOrNull(MutableHashMap.get(buckets, key))
    if (b !== null) b.mesh.setMatrixAt(slot, matrix)
  }

  const setColorAt = (
    type: EntityType,
    role: PartRole,
    slot: number,
    color: number,
  ): void => {
    const key = makeBucketKey(type, role)
    const b = Option.getOrNull(MutableHashMap.get(buckets, key))
    if (b !== null) b.mesh.setColorAt(slot, scratchColor.setHex(color))
  }

  const flushAll = (): void => {
    for (const [, bucket] of buckets) {
      bucket.mesh.instanceMatrix.needsUpdate = true
      if (bucket.mesh.instanceColor !== null) bucket.mesh.instanceColor.needsUpdate = true
    }
  }

  const getBuckets = (): ReadonlyArray<Bucket> => {
    const out: Array<Bucket> = []
    for (const [, b] of buckets) out.push(b)
    return out
  }

  const disposeAll = (scene: THREE.Scene): void => {
    for (const [, b] of buckets) {
      scene.remove(b.mesh)
      b.geometry.dispose()
      b.material.dispose()
    }
    MutableHashMap.clear(buckets)
    MutableHashMap.clear(slotIndex)
  }

  const getSlot = (
    type: EntityType,
    role: PartRole,
    entityId: string,
  ): Option.Option<{ readonly slot: number; readonly bucket: Bucket }> => {
    const key = makeBucketKey(type, role)
    const bucket = Option.getOrNull(MutableHashMap.get(buckets, key))
    if (bucket === null) return Option.none()
    const idx = Option.getOrNull(MutableHashMap.get(slotIndex, key))
    if (idx === null) return Option.none()
    const slot = Option.getOrNull(MutableHashMap.get(idx, entityId))
    return slot === null ? Option.none() : Option.some({ slot, bucket })
  }

  return {
    ensureBucket,
    allocateSlot,
    releaseSlot,
    setMatrixAt,
    setColorAt,
    flushAll,
    getBuckets,
    disposeAll,
    getSlot,
  }
}
