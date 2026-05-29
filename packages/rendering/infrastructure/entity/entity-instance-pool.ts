import * as THREE from 'three'
import type { EntityType } from '@ts-minecraft/entities'
import { MutableHashMap, Option } from 'effect'

// FR-2.5: per (mobType, partKey) InstancedMesh pool. Replaces the previous
// 6-meshes-per-mob THREE.Group approach (~7 draw calls/mob) with a fixed set
// of InstancedMeshes — at most 24 buckets (4 entity types × 6 roles) regardless
// of how many mobs are alive. Drawcalls scale with active bucket count, NOT
// mob count, so 30 mobs = 24 draw calls (was 180-210 in the legacy per-mob
// Group path).

// Hard cap per bucket. We never grow — if a bucket fills, additional mobs of
// that (type, part) combo are silently dropped from rendering. With 30-mob
// caps in the entity manager this is comfortably above the working set.
export const MAX_INSTANCES_PER_TYPE = 256

// Roles align with MobLimbGroup fields. We store a per-(type, role) bucket
// because mob types have different geometry sizes per role (e.g. zombie head
// = 0.5×0.5×0.5 vs cow head = 0.5×0.5×0.4) so geometry cannot be shared
// across types within a single InstancedMesh.
export type PartRole = 'head' | 'body' | 'armL' | 'armR' | 'legFL' | 'legFR' | 'legBL' | 'legBR'

// Geometry pivot policy mirrors mob-geometry.ts:
//   - head/body: geometric center pivot
//   - arm/leg: TOP-CENTER pivot (so rotation.x swings from the shoulder/hip)
type Dim3 = readonly [number, number, number]
type RolePivot = 'center' | 'top'

type RoleSpec = Readonly<{
  size: Dim3
  pivot: RolePivot
  // Local offset from mob root to the part pivot. Combined with per-mob world
  // transform to produce the InstancedMesh matrix.
  offset: { readonly x: number; readonly y: number; readonly z: number }
  color: number
  // Optional: which axis carries the swing angle (currently always 'x'). Kept
  // explicit so future limb-types could rotate around y/z without code change.
  swingAxis: 'x' | null
}>

// ---------------------------------------------------------------------------
// Per-type role specs — derived from mob-geometry.ts. Kept as plain literals so
// the layout cost is paid once at module load.
// ---------------------------------------------------------------------------

// Biped layout (Zombie):
//   parts: head=[0.5,0.5,0.5], body=[0.5,0.75,0.25], arm=[0.25,0.75,0.25], leg=[0.25,0.75,0.25]
//   palette: head=0x5a8a3a, body=0x3f5e7a, arm=0x5a8a3a, leg=0x5a8a3a
const ZOMBIE_LEG_H = 0.75
const ZOMBIE_BODY_W = 0.5
const ZOMBIE_BODY_H = 0.75
const ZOMBIE_HEAD_H = 0.5
const ZOMBIE_ARM_W = 0.25

const ZOMBIE_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.5, 0.5, 0.5],
    pivot: 'center',
    offset: { x: 0, y: ZOMBIE_LEG_H + ZOMBIE_BODY_H + ZOMBIE_HEAD_H / 2, z: 0 },
    color: 0x5a8a3a,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.5, 0.75, 0.25],
    pivot: 'center',
    offset: { x: 0, y: ZOMBIE_LEG_H + ZOMBIE_BODY_H / 2, z: 0 },
    color: 0x3f5e7a,
    swingAxis: null,
  }),
  armL: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: +(ZOMBIE_BODY_W / 2 + ZOMBIE_ARM_W / 2), y: ZOMBIE_LEG_H + ZOMBIE_BODY_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  armR: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: -(ZOMBIE_BODY_W / 2 + ZOMBIE_ARM_W / 2), y: ZOMBIE_LEG_H + ZOMBIE_BODY_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  legFL: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: +0.125, y: ZOMBIE_LEG_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  legFR: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: -0.125, y: ZOMBIE_LEG_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  legBL: Option.none(),
  legBR: Option.none(),
}

// Quadruped layout helper.
const buildQuadrupedSpecs = (
  parts: { head: Dim3; body: Dim3; leg: Dim3 },
  palette: { head: number; body: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [legW, legH, legD] = parts.leg
  const xOff = bodyW / 2 - legW / 2
  const zOff = bodyD / 2 - legD / 2
  const hipY = legH

  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH - headH / 2 + 0.1, z: bodyD / 2 + headD / 2 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({
      size: parts.body,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH / 2, z: 0 },
      color: palette.body,
      swingAxis: null,
    }),
    armL: Option.none(),
    armR: Option.none(),
    legFL: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: +xOff, y: hipY, z: +zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legFR: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: -xOff, y: hipY, z: +zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legBL: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: +xOff, y: hipY, z: -zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legBR: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: -xOff, y: hipY, z: -zOff }, color: palette.leg, swingAxis: 'x',
    }),
  }
}

const COW_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.5, 0.4], body: [0.625, 0.5, 1.0], leg: [0.25, 0.75, 0.25] },
  { head: 0x4a3020, body: 0x4a3020, leg: 0xf0f0f0 },
)
const PIG_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.5, 0.5, 0.625], leg: [0.25, 0.375, 0.25] },
  { head: 0xf0a0a0, body: 0xf0a0a0, leg: 0xf0a0a0 },
)
const SHEEP_SPECS = buildQuadrupedSpecs(
  { head: [0.375, 0.375, 0.5], body: [0.5, 0.5, 0.875], leg: [0.25, 0.75, 0.25] },
  { head: 0xf0d8b0, body: 0xf5f5f5, leg: 0xf0d8b0 },
)

// Creeper: quadruped (4 stubby legs), no arms, dark-green all over.
const CREEPER_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.5, 0.75, 0.375], leg: [0.25, 0.5, 0.25] },
  { head: 0x2d5c1e, body: 0x2d5c1e, leg: 0x2d5c1e },
)

// Skeleton: biped like Zombie but thinner arms and bone-white palette.
const SKELETON_LEG_H = 0.75
const SKELETON_BODY_W = 0.5
const SKELETON_BODY_H = 0.75
const SKELETON_HEAD_H = 0.5
const SKELETON_ARM_W = 0.125

const SKELETON_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.5, 0.5, 0.5],
    pivot: 'center',
    offset: { x: 0, y: SKELETON_LEG_H + SKELETON_BODY_H + SKELETON_HEAD_H / 2, z: 0 },
    color: 0xf0f0f0,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.5, 0.75, 0.125],
    pivot: 'center',
    offset: { x: 0, y: SKELETON_LEG_H + SKELETON_BODY_H / 2, z: 0 },
    color: 0xf0f0f0,
    swingAxis: null,
  }),
  armL: Option.some({
    size: [0.125, 0.75, 0.125],
    pivot: 'top',
    offset: { x: +(SKELETON_BODY_W / 2 + SKELETON_ARM_W / 2), y: SKELETON_LEG_H + SKELETON_BODY_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  armR: Option.some({
    size: [0.125, 0.75, 0.125],
    pivot: 'top',
    offset: { x: -(SKELETON_BODY_W / 2 + SKELETON_ARM_W / 2), y: SKELETON_LEG_H + SKELETON_BODY_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  legFL: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: +0.125, y: SKELETON_LEG_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  legFR: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: -0.125, y: SKELETON_LEG_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  legBL: Option.none(),
  legBR: Option.none(),
}

// Spider: dark low quadruped (sits close to ground), 8-legged simplified as 4.
const SPIDER_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.375, 0.5], body: [1.5, 0.375, 0.75], leg: [0.125, 0.5, 0.125] },
  { head: 0x2a2a2a, body: 0x2a2a2a, leg: 0x2a2a2a },
)

// Enderman: extremely tall biped — 3-block-high legs, purple-eye black body.
const ENDERMAN_LEG_H = 3.0
const ENDERMAN_BODY_W = 0.375
const ENDERMAN_BODY_H = 0.875
const ENDERMAN_HEAD_H = 0.5
const ENDERMAN_ARM_W = 0.125

const ENDERMAN_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.5, 0.5, 0.5],
    pivot: 'center',
    offset: { x: 0, y: ENDERMAN_LEG_H + ENDERMAN_BODY_H + ENDERMAN_HEAD_H / 2, z: 0 },
    color: 0x1a0d2e,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.375, 0.875, 0.25],
    pivot: 'center',
    offset: { x: 0, y: ENDERMAN_LEG_H + ENDERMAN_BODY_H / 2, z: 0 },
    color: 0x111111,
    swingAxis: null,
  }),
  armL: Option.some({
    size: [0.125, 1.5, 0.125],
    pivot: 'top',
    offset: { x: +(ENDERMAN_BODY_W / 2 + ENDERMAN_ARM_W / 2), y: ENDERMAN_LEG_H + ENDERMAN_BODY_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  armR: Option.some({
    size: [0.125, 1.5, 0.125],
    pivot: 'top',
    offset: { x: -(ENDERMAN_BODY_W / 2 + ENDERMAN_ARM_W / 2), y: ENDERMAN_LEG_H + ENDERMAN_BODY_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  legFL: Option.some({
    size: [0.125, 3.0, 0.125],
    pivot: 'top',
    offset: { x: +0.125, y: ENDERMAN_LEG_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  legFR: Option.some({
    size: [0.125, 3.0, 0.125],
    pivot: 'top',
    offset: { x: -0.125, y: ENDERMAN_LEG_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  legBL: Option.none(),
  legBR: Option.none(),
}

const SPECS_BY_TYPE: Readonly<Record<EntityType, Readonly<Record<PartRole, Option.Option<RoleSpec>>>>> = {
  Zombie: ZOMBIE_SPECS,
  Cow: COW_SPECS,
  Pig: PIG_SPECS,
  Sheep: SHEEP_SPECS,
  Creeper: CREEPER_SPECS,
  Skeleton: SKELETON_SPECS,
  Spider: SPIDER_SPECS,
  Enderman: ENDERMAN_SPECS,
}

export const getRoleSpec = (type: EntityType, role: PartRole): Option.Option<RoleSpec> =>
  SPECS_BY_TYPE[type][role]

export const ROLES_BY_TYPE: Readonly<Record<EntityType, ReadonlyArray<PartRole>>> = {
  Zombie: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Cow: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Pig: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Sheep: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Creeper: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Skeleton: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Spider: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Enderman: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
}

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
  // entityId at each slot index; null = free (only valid for slots >= count).
  readonly slotEntities: Array<string | null>
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

  const ensureBucket = (
    scene: THREE.Scene,
    type: EntityType,
    role: PartRole,
  ): Option.Option<Bucket> => {
    const specOpt = getRoleSpec(type, role)
    if (Option.isNone(specOpt)) return Option.none()
    const spec = specOpt.value
    const key = makeBucketKey(type, role)
    return Option.match(MutableHashMap.get(buckets, key), {
      onSome: Option.some,
      onNone: () => {
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
          slotEntities: Array.from({ length: MAX_INSTANCES_PER_TYPE }, (): string | null => null),
          count: 0,
        }
        MutableHashMap.set(buckets, key, bucket)
        MutableHashMap.set(slotIndex, key, MutableHashMap.empty<string, number>())
        return Option.some(bucket)
      },
    })
  }

  const allocateSlot = (
    scene: THREE.Scene,
    type: EntityType,
    role: PartRole,
    entityId: string,
  ): Option.Option<number> =>
    Option.flatMap(ensureBucket(scene, type, role), (bucket) => {
      if (bucket.count >= MAX_INSTANCES_PER_TYPE) return Option.none()
      const slot = bucket.count
      bucket.slotEntities[slot] = entityId
      bucket.count = slot + 1
      bucket.mesh.count = bucket.count
      const key = makeBucketKey(type, role)
      Option.match(MutableHashMap.get(slotIndex, key), {
        onSome: (idx) => MutableHashMap.set(idx, entityId, slot),
        onNone: () => {
          const idx = MutableHashMap.empty<string, number>()
          MutableHashMap.set(idx, entityId, slot)
          MutableHashMap.set(slotIndex, key, idx)
        },
      })
      return Option.some(slot)
    })

  const releaseSlot = (
    type: EntityType,
    role: PartRole,
    entityId: string,
  ): void => {
    const key = makeBucketKey(type, role)
    const bucketOpt = MutableHashMap.get(buckets, key)
    const idxOpt = MutableHashMap.get(slotIndex, key)
    if (Option.isNone(bucketOpt) || Option.isNone(idxOpt)) return
    const bucket = bucketOpt.value
    const idx = idxOpt.value
    const slotOpt = MutableHashMap.get(idx, entityId)
    if (Option.isNone(slotOpt)) return
    const slot = slotOpt.value
    const last = bucket.count - 1
    if (slot !== last) {
      // Swap last → slot: copy matrix from `last`, update bookkeeping.
      const movedEntity = bucket.slotEntities[last] ?? null
      const tmp = new THREE.Matrix4()
      bucket.mesh.getMatrixAt(last, tmp)
      bucket.mesh.setMatrixAt(slot, tmp)
      bucket.slotEntities[slot] = movedEntity
      if (movedEntity !== null) MutableHashMap.set(idx, movedEntity, slot)
    }
    bucket.slotEntities[last] = null
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
    Option.match(MutableHashMap.get(buckets, key), {
      onSome: (b) => b.mesh.setMatrixAt(slot, matrix),
      onNone: () => {},
    })
  }

  const flushAll = (): void => {
    for (const [, bucket] of buckets) bucket.mesh.instanceMatrix.needsUpdate = true
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
    for (const k of Array.from(MutableHashMap.keys(buckets))) MutableHashMap.remove(buckets, k)
    for (const k of Array.from(MutableHashMap.keys(slotIndex))) MutableHashMap.remove(slotIndex, k)
  }

  const getSlot = (
    type: EntityType,
    role: PartRole,
    entityId: string,
  ): Option.Option<{ readonly slot: number; readonly bucket: Bucket }> => {
    const key = makeBucketKey(type, role)
    return Option.flatMap(MutableHashMap.get(buckets, key), (bucket) =>
      Option.flatMap(MutableHashMap.get(slotIndex, key), (idx) =>
        Option.map(MutableHashMap.get(idx, entityId), (slot) => ({ slot, bucket })),
      ),
    )
  }

  return {
    ensureBucket,
    allocateSlot,
    releaseSlot,
    setMatrixAt,
    flushAll,
    getBuckets,
    disposeAll,
    getSlot,
  }
}
