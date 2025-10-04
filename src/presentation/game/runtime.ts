import * as THREE from 'three'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export interface GameRuntime {
  readonly start: () => void
  readonly pause: () => void
  readonly resume: () => void
  readonly stop: () => void
  readonly dispose: () => void
  readonly isRunning: () => boolean
  readonly container: HTMLDivElement
  readonly canvas: HTMLCanvasElement
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
}

export interface CreateGameRuntimeParams {
  readonly mount?: HTMLElement
  readonly renderer: THREE.WebGLRenderer
}

export const createGameRuntime = ({ mount, renderer }: CreateGameRuntimeParams): GameRuntime => {
  const container = document.createElement('div')
  container.id = 'game-root'
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    overflow: 'hidden',
    backgroundColor: '#000',
    display: 'block',
  })

  const canvas = renderer.domElement
  canvas.id = canvas.id || 'game-canvas'
  Object.assign(canvas.style, {
    width: '100%',
    height: '100%',
    display: 'block',
  })

  container.appendChild(canvas)
  ;(mount ?? document.body).appendChild(container)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 2, 6)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const directional = new THREE.DirectionalLight(0xffffff, 0.8)
  directional.position.set(5, 10, 7.5)
  directional.castShadow = true
  scene.add(directional)

  const textureLoader = new THREE.TextureLoader()
  const groundTexture = textureLoader.load('/assets/textures/blocks/grass_top.png', (texture) => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(32, 32)
    texture.colorSpace = THREE.SRGBColorSpace
  })

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200, 16, 16),
    new THREE.MeshStandardMaterial({ map: groundTexture })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const blockTexture = textureLoader.load('/assets/textures/blocks/cobblestone.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
  })
  const cubeMaterial = new THREE.MeshStandardMaterial({ map: blockTexture })
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
  const cubes: THREE.Mesh[] = []

  for (let x = -2; x <= 2; x += 2) {
    for (let z = -2; z <= 2; z += 2) {
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
      cube.position.set(x, 1, z)
      cube.castShadow = true
      scene.add(cube)
      cubes.push(cube)
    }
  }

  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const pressed = new Set<string>()
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ')
  const direction = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let animationFrame: number | null = null
  let running = false
  let lastTimestamp = performance.now()

  const handleKeyDown = (event: KeyboardEvent) => {
    pressed.add(event.key.toLowerCase())
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    pressed.delete(event.key.toLowerCase())
  }

  const handleResize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', handleResize)

  const updatePlayer = (delta: number) => {
    rotation.setFromVector3(camera.rotation.toVector3())

    const turnSpeed = 1.5
    if (pressed.has('arrowleft')) rotation.y += turnSpeed * delta
    if (pressed.has('arrowright')) rotation.y -= turnSpeed * delta
    if (pressed.has('arrowup')) rotation.x += turnSpeed * delta
    if (pressed.has('arrowdown')) rotation.x -= turnSpeed * delta

    rotation.x = clamp(rotation.x, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05)
    camera.rotation.set(rotation.x, rotation.y, 0)

    forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    forward.y = 0
    forward.normalize()

    right.copy(forward).cross(up).normalize().multiplyScalar(-1)
    direction.set(0, 0, 0)

    if (pressed.has('w')) direction.add(forward)
    if (pressed.has('s')) direction.add(forward.clone().multiplyScalar(-1))
    if (pressed.has('a')) direction.add(right)
    if (pressed.has('d')) direction.add(right.clone().multiplyScalar(-1))

    const moveSpeed = pressed.has('shift') ? 10 : 5

    if (direction.lengthSq() > 0) {
      direction.normalize()
      camera.position.addScaledVector(direction, moveSpeed * delta)
    }
  }

  const updateScene = (delta: number) => {
    cubes.forEach((cube, index) => {
      cube.rotation.x += delta * 0.8
      cube.rotation.y += delta * (0.6 + index * 0.05)
    })
  }

  const frame = (timestamp: number) => {
    const delta = (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp

    updatePlayer(delta)
    updateScene(delta)
    renderer.render(scene, camera)

    if (running) {
      animationFrame = window.requestAnimationFrame(frame)
    }
  }

  const startLoop = () => {
    if (running) return
    running = true
    lastTimestamp = performance.now()
    animationFrame = window.requestAnimationFrame(frame)
  }

  const stopLoop = () => {
    if (!running) return
    running = false
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  const dispose = () => {
    stopLoop()
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('resize', handleResize)

    groundTexture.dispose()
    blockTexture.dispose()
    cubeGeometry.dispose()
    cubeMaterial.dispose()

    if (container.parentElement) {
      container.parentElement.removeChild(container)
    }

    renderer.dispose()
  }

  handleResize()

  return {
    start: startLoop,
    pause: stopLoop,
    resume: startLoop,
    stop: stopLoop,
    dispose,
    isRunning: () => running,
    container,
    canvas,
    scene,
    camera,
  }
}
