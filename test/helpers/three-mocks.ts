import * as THREE from 'three'
import { Option } from 'effect'

export function mockScene(): THREE.Scene {
  return new THREE.Scene()
}

export function mockTexture(customUuid?: string): THREE.Texture {
  const texture = new THREE.Texture()
  if (customUuid !== undefined) texture.uuid = customUuid
  return texture
}

export function mockMaterial(customUuid?: string): THREE.Material {
  const material = new THREE.Material()
  if (customUuid !== undefined) material.uuid = customUuid
  return material
}

export function mockMeshBasicMaterial(options?: {
  color?: number
  map?: THREE.Texture
  transparent?: boolean
  opacity?: number
}): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: options?.color ?? 0xffffff })
  if (options?.map !== undefined) material.map = options.map
  if (options?.transparent !== undefined) material.transparent = options.transparent
  if (options?.opacity !== undefined) material.opacity = options.opacity
  return material
}

export function mockMeshStandardMaterial(options?: {
  color?: number
  map?: THREE.Texture
  roughness?: number
  metalness?: number
  transparent?: boolean
  opacity?: number
}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: options?.color ?? 0xffffff })
  if (options?.map !== undefined) material.map = options.map
  if (options?.roughness !== undefined) material.roughness = options.roughness
  if (options?.metalness !== undefined) material.metalness = options.metalness
  if (options?.transparent !== undefined) material.transparent = options.transparent
  if (options?.opacity !== undefined) material.opacity = options.opacity
  return material
}

export function mockBoxGeometry(width = 1, height = 1, depth = 1): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, depth)
}

export function mockMesh(options?: {
  geometry?: THREE.BoxGeometry
  material?: THREE.Material
  customUuid?: string
}): THREE.Mesh {
  const geometry = Option.getOrElse(Option.fromNullable(options?.geometry), () => new THREE.BoxGeometry(1, 1, 1))
  const material = Option.getOrElse(Option.fromNullable(options?.material), () => mockMaterial())
  const mesh = new THREE.Mesh(geometry, material)
  if (options?.customUuid !== undefined) mesh.uuid = options.customUuid
  return mesh
}

export function mockCanvasElement(): HTMLCanvasElement {
  const canvas: Partial<HTMLCanvasElement> & { width: number; height: number } = {
    width: 64,
    height: 64,
  }
  canvas.getContext = ((contextType: string) => {
    if (contextType !== '2d') return null
    return {
      fillStyle: '#ffffff',
      fillRect: () => {},
    }
  }) as HTMLCanvasElement['getContext']
  return canvas as HTMLCanvasElement
}

type WebGLRendererDouble = Partial<THREE.WebGLRenderer> & {
  readonly domElement: HTMLCanvasElement
  width: number
  height: number
}

export function mockWebGLRenderer(): THREE.WebGLRenderer {
  const canvas = mockCanvasElement()
  const renderer: WebGLRendererDouble = {
    domElement: canvas,
    width: canvas.width,
    height: canvas.height,
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
    info: {
      memory: { geometries: 0, textures: 0 },
      render: { calls: 0, triangles: 0, lines: 0, points: 0, frame: 0 },
      programs: null,
      autoReset: true,
      reset: () => {},
      update: () => {},
    },
    render: () => {},
    setSize: (width: number, height: number) => {
      renderer.width = width
      renderer.height = height
    },
    dispose: () => {},
    setScissor: () => {},
    setScissorTest: () => {},
    setViewport: () => {},
    clear: () => {},
    getPixelRatio: () => 1,
    setPixelRatio: () => {},
  }

  return renderer as THREE.WebGLRenderer
}

export function mockCamera(): THREE.Camera {
  const camera = new THREE.Camera()
  camera.getWorldDirection = () => new THREE.Vector3(0, 0, -1)
  return camera
}

export function mockPerspectiveCamera(fov = 75, aspect = 1, near = 0.1, far = 1000): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(fov, aspect, near, far)
}

export function mockGroup(): THREE.Group {
  return new THREE.Group()
}

export function mockVector3(x = 0, y = 0, z = 0): THREE.Vector3 {
  return new THREE.Vector3(x, y, z)
}

export function mockBox3(min?: THREE.Vector3, max?: THREE.Vector3): THREE.Box3 {
  const minVec = Option.getOrElse(Option.fromNullable(min), () => new THREE.Vector3(0, 0, 0))
  const maxVec = Option.getOrElse(Option.fromNullable(max), () => new THREE.Vector3(1, 1, 1))
  return new THREE.Box3(minVec, maxVec)
}

export function isMockScene(obj: unknown): obj is THREE.Scene {
  return obj instanceof THREE.Scene
}

export function isMockMesh(obj: unknown): obj is THREE.Mesh {
  return obj instanceof THREE.Mesh
}

export function isMockTexture(obj: unknown): obj is THREE.Texture {
  return obj instanceof THREE.Texture
}

export function isMockMaterial(obj: unknown): obj is THREE.Material {
  return obj instanceof THREE.Material
}
