import * as THREE from 'three'

import { BLOCK } from '@src/constant'

export const color = {
  sky: 0x00ffff,
}

const images = {
  dart: {
    side: 'assets/dart/side.jpeg',
  },
  grass: {
    top: 'assets/grass/top.jpeg',
    side: 'assets/grass/side.jpeg',
    bottom: 'assets/grass/bottom.jpeg',
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
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'bottom',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
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
  grass: [
    {
      name: 'left',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
    {
      name: 'right',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
    {
      name: 'top',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.grass.top) }),
    },
    {
      name: 'bottom',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.grass.bottom) }),
    },
    {
      name: 'back',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
    {
      name: 'front',
      material: new THREE.MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
  ],
}

export type DirectionName = 'left' | 'right' | 'top' | 'bottom' | 'back' | 'front'

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
