// Role/spec vocabulary shared by the spec builders (entity-instance-specs.builders.ts),
// the per-mob spec data (entity-instance-specs.ts), and the instance pool.

// Roles align with MobLimbGroup fields. We store a per-(type, role) bucket
// because mob types have different geometry sizes per role (e.g. zombie head
// = 0.5×0.5×0.5 vs cow head = 0.5×0.5×0.4) so geometry cannot be shared
// across types within a single InstancedMesh.
export type PartRole = 'head' | 'body' | 'armL' | 'armR' | 'legFL' | 'legFR' | 'legBL' | 'legBR'

// Geometry pivot policy mirrors mob-geometry.ts:
//   - head/body: geometric center pivot
//   - arm/leg: TOP-CENTER pivot (so rotation.x swings from the shoulder/hip)
export type Dim3 = readonly [number, number, number]
export type RolePivot = 'center' | 'top'

export type RoleSpec = Readonly<{
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
