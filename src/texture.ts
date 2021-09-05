import * as THREE from 'three'

import { texture } from './assets'

const loader = new THREE.TextureLoader()

export default {
  dart: [
    new THREE.MeshBasicMaterial({ map: loader.load(texture.dart.side) }),
    new THREE.MeshBasicMaterial({ map: loader.load(texture.dart.side) }),
    new THREE.MeshBasicMaterial({ map: loader.load(texture.dart.top) }),
    new THREE.MeshBasicMaterial({ map: loader.load(texture.dart.bottom) }),
    new THREE.MeshBasicMaterial({ map: loader.load(texture.dart.side) }),
    new THREE.MeshBasicMaterial({ map: loader.load(texture.dart.side) }),
  ],
}
