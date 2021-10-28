type DirectionName = 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front'

type BlockFace = {
  name: DirectionName
  direction: THREE.Vector3
}

type BlockTexture = {
  name: DirectionName
  material: THREE.MeshBasicMaterial
}

type TextureType = {
  [key: string]: BlockTexture[]
}
