import * as THREE from 'three'

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

export const texture = {
  dart: [
    new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    new THREE.MeshBasicMaterial({ map: loader.load(images.dart.top) }),
    new THREE.MeshBasicMaterial({ map: loader.load(images.dart.bottom) }),
    new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
  ],
}
