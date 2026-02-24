import * as THREE from 'three'

/**
 * Mock THREE.Scene factory
 * Creates a minimal mock scene for testing
 */
export function mockScene(): THREE.Scene {
  const scene = {
    uuid: 'mock-scene-uuid',
    type: 'Scene',
    children: [],
    add: (obj: unknown) => {
      ;(scene as { children: unknown[] }).children.push(obj)
      return scene
    },
    remove: (obj: unknown) => {
      const index = (scene as { children: unknown[] }).children.indexOf(obj)
      if (index > -1) {
        ;(scene as { children: unknown[] }).children.splice(index, 1)
      }
      return scene
    },
    clear: () => {
      ;(scene as { children: unknown[] }).children.length = 0
    },
    traverse: (callback: (obj: unknown) => void) => {
      ;(scene as { children: unknown[] }).children.forEach(callback)
    },
    userData: {},
    version: 0,
    onBeforeRender: () => {},
    onAfterRender: () => {},
  } as unknown as THREE.Scene

  return scene
}

/**
 * Mock THREE.Texture factory
 * Creates a minimal mock texture for testing
 */
export function mockTexture(customUuid?: string): THREE.Texture {
  const texture = {
    uuid: customUuid ?? `mock-texture-uuid-${Math.random().toString(36).substring(7)}`,
    source: {
      data: null,
      version: 0,
    },
    image: null,
    mipmaps: [],
    mapping: THREE.UVMapping,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearMipmapLinearFilter,
    anisotropy: 1,
    format: THREE.RGBAFormat,
    internalFormat: null,
    type: THREE.UnsignedByteType,
    generateMipmaps: true,
    premultiplyAlpha: false,
    flipY: true,
    unpackAlignment: 4,
    colorSpace: THREE.SRGBColorSpace,
    userData: {},
    version: 0,
    onUpdate: () => {},
    needsUpdate: false,
    dispose: () => {},
    transformUv: (uv: THREE.Vector2) => uv,
    matrix: new THREE.Matrix3(),
    matrixAutoUpdate: true,
    center: new THREE.Vector2(0.5, 0.5),
    rotation: 0,
    repeat: new THREE.Vector2(1, 1),
    offset: new THREE.Vector2(0, 0),
  } as unknown as THREE.Texture

  return texture
}

/**
 * Mock THREE.Material factory
 * Creates a minimal mock material for testing
 */
export function mockMaterial(customUuid?: string): THREE.Material {
  return {
    uuid: customUuid ?? `mock-material-uuid-${Math.random().toString(36).substring(7)}`,
    name: '',
    type: 'Material',
    side: THREE.FrontSide,
    fog: true,
    blending: THREE.NormalBlending,
    transparent: false,
    opacity: 1,
    depthFunc: THREE.LessEqualDepth,
    depthTest: true,
    depthWrite: true,
    stencilWrite: false,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilRef: 0,
    stencilWriteMask: 0xff,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
    userData: {},
    version: 0,
    alphaToCoverage: false,
    needsUpdate: false,
    onBeforeCompile: () => {},
    setValues: () => {},
    dispose: () => {},
  } as unknown as THREE.Material
}

/**
 * Mock THREE.MeshBasicMaterial factory
 * Creates a minimal mock mesh basic material for testing
 */
export function mockMeshBasicMaterial(options?: {
  color?: number
  map?: THREE.Texture
  transparent?: boolean
  opacity?: number
}): THREE.MeshBasicMaterial {
  const material = {
    uuid: `mock-mesh-basic-material-uuid-${Math.random().toString(36).substring(7)}`,
    name: '',
    type: 'MeshBasicMaterial',
    side: THREE.FrontSide,
    fog: true,
    blending: THREE.NormalBlending,
    transparent: options?.transparent ?? false,
    opacity: options?.opacity ?? 1,
    depthFunc: THREE.LessEqualDepth,
    depthTest: true,
    depthWrite: true,
    stencilWrite: false,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilRef: 0,
    stencilWriteMask: 0xff,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
    userData: {},
    version: 0,
    alphaToCoverage: false,
    needsUpdate: false,
    onBeforeCompile: () => {},
    setValues: () => {},
    dispose: () => {},
    color: new THREE.Color(options?.color ?? 0xffffff),
    map: options?.map ?? null,
  } as unknown as THREE.MeshBasicMaterial

  return material
}

/**
 * Mock THREE.MeshStandardMaterial factory
 * Creates a minimal mock mesh standard material for testing
 */
export function mockMeshStandardMaterial(options?: {
  color?: number
  map?: THREE.Texture
  roughness?: number
  metalness?: number
  transparent?: boolean
  opacity?: number
}): THREE.MeshStandardMaterial {
  const material = {
    uuid: `mock-mesh-standard-material-uuid-${Math.random().toString(36).substring(7)}`,
    name: '',
    type: 'MeshStandardMaterial',
    side: THREE.FrontSide,
    fog: true,
    blending: THREE.NormalBlending,
    transparent: options?.transparent ?? false,
    opacity: options?.opacity ?? 1,
    depthFunc: THREE.LessEqualDepth,
    depthTest: true,
    depthWrite: true,
    stencilWrite: false,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilRef: 0,
    stencilWriteMask: 0xff,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
    userData: {},
    version: 0,
    alphaToCoverage: false,
    needsUpdate: false,
    onBeforeCompile: () => {},
    setValues: () => {},
    dispose: () => {},
    color: new THREE.Color(options?.color ?? 0xffffff),
    map: options?.map ?? null,
    roughness: options?.roughness ?? 0.5,
    metalness: options?.metalness ?? 0,
  } as unknown as THREE.MeshStandardMaterial

  return material
}

/**
 * Mock THREE.BoxGeometry factory
 * Creates a minimal mock box geometry for testing
 */
export function mockBoxGeometry(width = 1, height = 1, depth = 1): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth) as THREE.BoxGeometry
  return geometry
}

/**
 * Mock THREE.Mesh factory
 * Creates a minimal mock mesh for testing
 */
export function mockMesh(options?: {
  geometry?: THREE.BoxGeometry
  material?: THREE.Material
  customUuid?: string
}): THREE.Mesh {
  const geometry = options?.geometry ?? new THREE.BoxGeometry(1, 1, 1)
  const material = options?.material ?? mockMaterial()
  const uuid = options?.customUuid ?? `mock-mesh-uuid-${Math.random().toString(36).substring(7)}`

  const mesh = new THREE.Mesh(geometry, material)
  ;(mesh as THREE.Mesh & { uuid: string }).uuid = uuid

  return mesh
}

export function mockCanvasElement(): HTMLCanvasElement {
  const canvas = {
    width: 64,
    height: 64,
    getContext: (contextType: string) => {
      if (contextType === '2d') {
        return {
          fillStyle: '#ffffff',
          fillRect: () => {},
        }
      }
      return null
    },
  } as unknown as HTMLCanvasElement

  return canvas
}

/**
 * Mock THREE.WebGLRenderer factory
 * Creates a minimal mock renderer for testing
 */
export function mockWebGLRenderer(): THREE.WebGLRenderer {
  const canvas = mockCanvasElement()
  const renderer = {
    domElement: canvas,
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
    sortObjects: true,
    clippingPlanes: [],
    localClippingEnabled: false,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    width: canvas.width,
    height: canvas.height,
    xr: null,
    shadowMap: null,
    info: {
      memory: { programs: 0, geometries: 0, textures: 0 },
      render: { calls: 0, triangles: 0, lines: 0, points: 0 },
      frame: 0,
    },
    render: (_scene: THREE.Scene, _camera: THREE.Camera) => {
      // No-op for mock
    },
    setSize: (width: number, height: number) => {
      ;(renderer as { width: number; height: number }).width = width
      ;(renderer as { height: number }).height = height
    },
    dispose: () => {
      // No-op for mock
    },
    setScissor: () => {},
    setScissorTest: () => {},
    setViewport: () => {},
    clear: () => {},
    getPixelRatio: () => 1,
    setPixelRatio: () => {},
  } as unknown as THREE.WebGLRenderer

  return renderer
}

/**
 * Mock THREE.Camera factory
 * Creates a minimal mock camera for testing
 */
export function mockCamera(): THREE.Camera {
  const camera = {
    uuid: `mock-camera-uuid-${Math.random().toString(36).substring(7)}`,
    name: '',
    type: 'Camera',
    parent: null,
    children: [],
    up: new THREE.Vector3(0, 1, 0),
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
    quaternion: new THREE.Quaternion(0, 0, 0, 1),
    scale: new THREE.Vector3(1, 1, 1),
    matrix: new THREE.Matrix4(),
    matrixWorld: new THREE.Matrix4(),
    matrixAutoUpdate: true,
    matrixWorldAutoUpdate: true,
    visible: true,
    frustumCulled: true,
    renderOrder: 0,
    userData: {},
    castShadow: false,
    receiveShadow: false,
    getWorldDirection: () => new THREE.Vector3(0, 0, -1),
    updateMatrix: () => {},
    updateMatrixWorld: () => {},
  } as unknown as THREE.Camera

  return camera
}

/**
 * Mock THREE.PerspectiveCamera factory
 * Creates a minimal mock perspective camera for testing
 */
export function mockPerspectiveCamera(fov = 75, aspect = 1, near = 0.1, far = 1000): THREE.PerspectiveCamera {
  const camera = {
    uuid: `mock-perspective-camera-uuid-${Math.random().toString(36).substring(7)}`,
    name: '',
    type: 'PerspectiveCamera',
    parent: null,
    children: [],
    up: new THREE.Vector3(0, 1, 0),
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
    quaternion: new THREE.Quaternion(0, 0, 0, 1),
    scale: new THREE.Vector3(1, 1, 1),
    matrix: new THREE.Matrix4(),
    matrixWorld: new THREE.Matrix4(),
    matrixAutoUpdate: true,
    matrixWorldAutoUpdate: true,
    visible: true,
    frustumCulled: true,
    renderOrder: 0,
    userData: {},
    castShadow: false,
    receiveShadow: false,
    getWorldDirection: () => new THREE.Vector3(0, 0, -1),
    updateMatrix: () => {},
    updateMatrixWorld: () => {},
    fov,
    aspect,
    near,
    far,
    zoom: 1,
    focus: 10,
    view: null,
    filmGauge: 35,
    filmOffset: 0,
    updateProjectionMatrix: () => {},
  } as unknown as THREE.PerspectiveCamera

  return camera
}

/**
 * Mock THREE.Group factory
 * Creates a minimal mock group for testing
 */
export function mockGroup(): THREE.Group {
  const group = {
    uuid: `mock-group-uuid-${Math.random().toString(36).substring(7)}`,
    name: '',
    type: 'Group',
    parent: null,
    children: [],
    up: new THREE.Vector3(0, 1, 0),
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
    quaternion: new THREE.Quaternion(0, 0, 0, 1),
    scale: new THREE.Vector3(1, 1, 1),
    matrix: new THREE.Matrix4(),
    matrixWorld: new THREE.Matrix4(),
    matrixAutoUpdate: true,
    matrixWorldAutoUpdate: true,
    visible: true,
    frustumCulled: true,
    renderOrder: 0,
    userData: {},
    castShadow: false,
    receiveShadow: false,
    getWorldDirection: () => new THREE.Vector3(0, 0, -1),
    updateMatrix: () => {},
    updateMatrixWorld: () => {},
    add: (obj: unknown) => {
      ;(group as { children: unknown[] }).children.push(obj)
      return group
    },
    remove: (obj: unknown) => {
      const index = (group as { children: unknown[] }).children.indexOf(obj)
      if (index > -1) {
        ;(group as { children: unknown[] }).children.splice(index, 1)
      }
      return group
    },
    clear: () => {
      ;(group as { children: unknown[] }).children.length = 0
    },
    traverse: (callback: (obj: unknown) => void) => {
      ;(group as { children: unknown[] }).children.forEach(callback)
    },
  } as unknown as THREE.Group

  return group
}

/**
 * Mock THREE.Vector3 factory
 * Creates a minimal mock vector3 for testing
 */
export function mockVector3(x = 0, y = 0, z = 0): THREE.Vector3 {
  return new THREE.Vector3(x, y, z)
}

/**
 * Mock THREE.Box3 factory
 * Creates a minimal mock box3 for testing
 */
export function mockBox3(min?: THREE.Vector3, max?: THREE.Vector3): THREE.Box3 {
  const minVec = min ?? new THREE.Vector3(0, 0, 0)
  const maxVec = max ?? new THREE.Vector3(1, 1, 1)
  return new THREE.Box3(minVec, maxVec)
}

/**
 * Type guards for mock objects
 */
export function isMockScene(obj: unknown): obj is THREE.Scene {
  return obj !== null && typeof obj === 'object' && (obj as THREE.Scene).type === 'Scene'
}

export function isMockMesh(obj: unknown): obj is THREE.Mesh {
  return obj !== null && typeof obj === 'object' && (obj as THREE.Mesh).type === 'Mesh'
}

export function isMockTexture(obj: unknown): obj is THREE.Texture {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'source' in obj &&
    'mapping' in obj &&
    'wrapS' in obj
  )
}

export function isMockMaterial(obj: unknown): obj is THREE.Material {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    (obj as THREE.Material).type !== undefined
  )
}
