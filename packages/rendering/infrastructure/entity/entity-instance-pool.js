import * as THREE from 'three';
import { MutableHashMap, Option } from 'effect';
// FR-2.5: per (mobType, partKey) InstancedMesh pool. Replaces the previous
// 6-meshes-per-mob THREE.Group approach (~7 draw calls/mob) with a fixed set
// of InstancedMeshes — at most 24 buckets (4 entity types × 6 roles) regardless
// of how many mobs are alive. Drawcalls scale with active bucket count, NOT
// mob count, so 30 mobs = 24 draw calls (was 180-210 in the legacy per-mob
// Group path).
// Hard cap per bucket. We never grow — if a bucket fills, additional mobs of
// that (type, part) combo are silently dropped from rendering. With 30-mob
// caps in the entity manager this is comfortably above the working set.
export const MAX_INSTANCES_PER_TYPE = 256;
// ---------------------------------------------------------------------------
// Per-type role specs — derived from mob-geometry.ts. Kept as plain literals so
// the layout cost is paid once at module load.
// ---------------------------------------------------------------------------
// Biped layout (Zombie):
//   parts: head=[0.5,0.5,0.5], body=[0.5,0.75,0.25], arm=[0.25,0.75,0.25], leg=[0.25,0.75,0.25]
//   palette: head=0x5a8a3a, body=0x3f5e7a, arm=0x5a8a3a, leg=0x5a8a3a
const ZOMBIE_LEG_H = 0.75;
const ZOMBIE_BODY_W = 0.5;
const ZOMBIE_BODY_H = 0.75;
const ZOMBIE_HEAD_H = 0.5;
const ZOMBIE_ARM_W = 0.25;
const ZOMBIE_SPECS = {
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
};
// Quadruped layout helper.
const buildQuadrupedSpecs = (parts, palette) => {
    const [bodyW, bodyH, bodyD] = parts.body;
    const [, headH, headD] = parts.head;
    const [legW, legH, legD] = parts.leg;
    const xOff = bodyW / 2 - legW / 2;
    const zOff = bodyD / 2 - legD / 2;
    const hipY = legH;
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
    };
};
const COW_SPECS = buildQuadrupedSpecs({ head: [0.5, 0.5, 0.4], body: [0.625, 0.5, 1.0], leg: [0.25, 0.75, 0.25] }, { head: 0x4a3020, body: 0x4a3020, leg: 0xf0f0f0 });
const PIG_SPECS = buildQuadrupedSpecs({ head: [0.5, 0.5, 0.5], body: [0.5, 0.5, 0.625], leg: [0.25, 0.375, 0.25] }, { head: 0xf0a0a0, body: 0xf0a0a0, leg: 0xf0a0a0 });
const SHEEP_SPECS = buildQuadrupedSpecs({ head: [0.375, 0.375, 0.5], body: [0.5, 0.5, 0.875], leg: [0.25, 0.75, 0.25] }, { head: 0xf0d8b0, body: 0xf5f5f5, leg: 0xf0d8b0 });
const SPECS_BY_TYPE = {
    Zombie: ZOMBIE_SPECS,
    Cow: COW_SPECS,
    Pig: PIG_SPECS,
    Sheep: SHEEP_SPECS,
};
export const getRoleSpec = (type, role) => SPECS_BY_TYPE[type][role];
export const ROLES_BY_TYPE = {
    Zombie: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
    Cow: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
    Pig: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
    Sheep: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
};
const makeBucketKey = (type, role) => `${type}:${role}`;
const buildBucketGeometry = (size, pivot) => {
    const [w, h, d] = size;
    const g = new THREE.BoxGeometry(w, h, d);
    if (pivot === 'top')
        g.translate(0, -h / 2, 0);
    return g;
};
export const createEntityInstancePool = () => {
    const buckets = MutableHashMap.empty();
    // Per-bucket entityId → slot index. Lookup avoids scanning slotEntities.
    const slotIndex = MutableHashMap.empty();
    const ensureBucket = (scene, type, role) => {
        const specOpt = getRoleSpec(type, role);
        if (Option.isNone(specOpt))
            return Option.none();
        const spec = specOpt.value;
        const key = makeBucketKey(type, role);
        return Option.match(MutableHashMap.get(buckets, key), {
            onSome: Option.some,
            onNone: () => {
                const geometry = buildBucketGeometry(spec.size, spec.pivot);
                const material = new THREE.MeshStandardMaterial({
                    color: spec.color,
                    roughness: 0.9,
                    metalness: 0.0,
                });
                const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_TYPE);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.count = 0; // start empty; grows as slots are allocated
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                mesh.frustumCulled = true; // bucket-level culling matches FR-2.5 design
                scene.add(mesh);
                const bucket = {
                    mesh,
                    geometry,
                    material,
                    spec,
                    slotEntities: Array.from({ length: MAX_INSTANCES_PER_TYPE }, () => null),
                    count: 0,
                };
                MutableHashMap.set(buckets, key, bucket);
                MutableHashMap.set(slotIndex, key, MutableHashMap.empty());
                return Option.some(bucket);
            },
        });
    };
    const allocateSlot = (scene, type, role, entityId) => Option.flatMap(ensureBucket(scene, type, role), (bucket) => {
        if (bucket.count >= MAX_INSTANCES_PER_TYPE)
            return Option.none();
        const slot = bucket.count;
        bucket.slotEntities[slot] = entityId;
        bucket.count = slot + 1;
        bucket.mesh.count = bucket.count;
        const key = makeBucketKey(type, role);
        Option.match(MutableHashMap.get(slotIndex, key), {
            onSome: (idx) => MutableHashMap.set(idx, entityId, slot),
            onNone: () => {
                const idx = MutableHashMap.empty();
                MutableHashMap.set(idx, entityId, slot);
                MutableHashMap.set(slotIndex, key, idx);
            },
        });
        return Option.some(slot);
    });
    const releaseSlot = (type, role, entityId) => {
        const key = makeBucketKey(type, role);
        const bucketOpt = MutableHashMap.get(buckets, key);
        const idxOpt = MutableHashMap.get(slotIndex, key);
        if (Option.isNone(bucketOpt) || Option.isNone(idxOpt))
            return;
        const bucket = bucketOpt.value;
        const idx = idxOpt.value;
        const slotOpt = MutableHashMap.get(idx, entityId);
        if (Option.isNone(slotOpt))
            return;
        const slot = slotOpt.value;
        const last = bucket.count - 1;
        if (slot !== last) {
            // Swap last → slot: copy matrix from `last`, update bookkeeping.
            const movedEntity = bucket.slotEntities[last] ?? null;
            const tmp = new THREE.Matrix4();
            bucket.mesh.getMatrixAt(last, tmp);
            bucket.mesh.setMatrixAt(slot, tmp);
            bucket.slotEntities[slot] = movedEntity;
            if (movedEntity !== null)
                MutableHashMap.set(idx, movedEntity, slot);
        }
        bucket.slotEntities[last] = null;
        bucket.count = last;
        bucket.mesh.count = last;
        MutableHashMap.remove(idx, entityId);
        bucket.mesh.instanceMatrix.needsUpdate = true;
    };
    const setMatrixAt = (type, role, slot, matrix) => {
        const key = makeBucketKey(type, role);
        Option.match(MutableHashMap.get(buckets, key), {
            onSome: (b) => b.mesh.setMatrixAt(slot, matrix),
            onNone: () => { },
        });
    };
    const flushAll = () => {
        for (const [, bucket] of buckets)
            bucket.mesh.instanceMatrix.needsUpdate = true;
    };
    const getBuckets = () => {
        const out = [];
        for (const [, b] of buckets)
            out.push(b);
        return out;
    };
    const disposeAll = (scene) => {
        for (const [, b] of buckets) {
            scene.remove(b.mesh);
            b.geometry.dispose();
            b.material.dispose();
        }
        for (const k of Array.from(MutableHashMap.keys(buckets)))
            MutableHashMap.remove(buckets, k);
        for (const k of Array.from(MutableHashMap.keys(slotIndex)))
            MutableHashMap.remove(slotIndex, k);
    };
    const getSlot = (type, role, entityId) => {
        const key = makeBucketKey(type, role);
        return Option.flatMap(MutableHashMap.get(buckets, key), (bucket) => Option.flatMap(MutableHashMap.get(slotIndex, key), (idx) => Option.map(MutableHashMap.get(idx, entityId), (slot) => ({ slot, bucket }))));
    };
    return {
        ensureBucket,
        allocateSlot,
        releaseSlot,
        setMatrixAt,
        flushAll,
        getBuckets,
        disposeAll,
        getSlot,
    };
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/entity/entity-instance-pool.js.map