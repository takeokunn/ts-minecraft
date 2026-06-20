import * as THREE from 'three'
import { MutableHashMap, Option } from 'effect'

export type MobLimbGroup = Readonly<{
  root: THREE.Group
  head: THREE.Mesh
  body: THREE.Mesh
  armL: THREE.Mesh | null
  armR: THREE.Mesh | null
  legFL: THREE.Mesh
  legFR: THREE.Mesh
  legBL: THREE.Mesh | null
  legBR: THREE.Mesh | null
}>

type Dim3 = readonly [number, number, number]

const geometryCache = MutableHashMap.empty<string, THREE.BoxGeometry>()
const materialCache = MutableHashMap.empty<string, THREE.MeshStandardMaterial>()

export const getOrCreateGeometry = (key: string, size: Dim3, pivotTop: boolean): THREE.BoxGeometry => {
  const cached = Option.getOrNull(MutableHashMap.get(geometryCache, key))
  if (cached !== null) return cached
  const [w, h, d] = size
  const geometry = new THREE.BoxGeometry(w, h, d)
  if (pivotTop) {
    geometry.translate(0, -h / 2, 0)
  }
  MutableHashMap.set(geometryCache, key, geometry)
  return geometry
}

export const getOrCreateMaterial = (key: string, color: number): THREE.MeshStandardMaterial => {
  const cached = Option.getOrNull(MutableHashMap.get(materialCache, key))
  if (cached !== null) return cached
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.9, metalness: 0.0 })
  MutableHashMap.set(materialCache, key, material)
  return material
}

