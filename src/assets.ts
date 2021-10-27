import * as THREE from 'three'

import { BLOCK } from '@src/constant'

export const color = {
  sky: 0x00ffff,
}

const images = {
  dart: {
    top: 'assets/dart/top.jpeg',
    side: 'assets/dart/side.jpeg',
    bottom: 'assets/dart/bottom.jpeg',
  },
}

const loader = new THREE.TextureLoader()

type TextureType = {
  [key: string]: BlockTexture[]
}

export const texture: TextureType = {
  dart: [
    {
      name: 'left',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'right',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'top',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.top) }),
    },
    {
      name: 'bottom',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.bottom) }),
    },
    {
      name: 'back',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'front',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
  ],
}

export type DirectionName = 'left' | 'right' |  'top' | 'bottom' | 'back' | 'front'

export type BlockFace = {
  name: DirectionName
  direction: THREE.Vector3
}

export type BlockTexture = {
  name: DirectionName
  material: THREE.MeshBasicMaterial
}

export const faces: BlockFace[] = [
  {
    name: 'left',
    direction: new THREE.Vector3(BLOCK.SIZE, 0, 0),
  },
  {
    name: 'right',
    direction: new THREE.Vector3(-BLOCK.SIZE, 0, 0),
  },
  {
    name: 'top',
    direction: new THREE.Vector3(0, BLOCK.SIZE, 0),
  },
  {
    name: 'bottom',
    direction: new THREE.Vector3(0, -BLOCK.SIZE, 0),
  },
  {
    name: 'back',
    direction: new THREE.Vector3(0, 0, BLOCK.SIZE),
  },
  {
    name: 'front',
    direction: new THREE.Vector3(0, 0, -BLOCK.SIZE),
  },
]
