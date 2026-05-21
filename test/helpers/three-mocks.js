import * as THREE from 'three';
import { Option } from 'effect';
export function mockScene() {
    return new THREE.Scene();
}
export function mockTexture(customUuid) {
    const texture = new THREE.Texture();
    if (customUuid !== undefined)
        texture.uuid = customUuid;
    return texture;
}
export function mockMaterial(customUuid) {
    const material = new THREE.Material();
    if (customUuid !== undefined)
        material.uuid = customUuid;
    return material;
}
export function mockMeshBasicMaterial(options) {
    const material = new THREE.MeshBasicMaterial({ color: options?.color ?? 0xffffff });
    if (options?.map !== undefined)
        material.map = options.map;
    if (options?.transparent !== undefined)
        material.transparent = options.transparent;
    if (options?.opacity !== undefined)
        material.opacity = options.opacity;
    return material;
}
export function mockMeshStandardMaterial(options) {
    const material = new THREE.MeshStandardMaterial({ color: options?.color ?? 0xffffff });
    if (options?.map !== undefined)
        material.map = options.map;
    if (options?.roughness !== undefined)
        material.roughness = options.roughness;
    if (options?.metalness !== undefined)
        material.metalness = options.metalness;
    if (options?.transparent !== undefined)
        material.transparent = options.transparent;
    if (options?.opacity !== undefined)
        material.opacity = options.opacity;
    return material;
}
export function mockBoxGeometry(width = 1, height = 1, depth = 1) {
    return new THREE.BoxGeometry(width, height, depth);
}
export function mockMesh(options) {
    const geometry = Option.getOrElse(Option.fromNullable(options?.geometry), () => new THREE.BoxGeometry(1, 1, 1));
    const material = Option.getOrElse(Option.fromNullable(options?.material), () => mockMaterial());
    const mesh = new THREE.Mesh(geometry, material);
    if (options?.customUuid !== undefined)
        mesh.uuid = options.customUuid;
    return mesh;
}
export function mockCanvasElement() {
    const canvas = {
        width: 64,
        height: 64,
    };
    canvas.getContext = ((contextType) => {
        if (contextType !== '2d')
            return null;
        return {
            fillStyle: '#ffffff',
            fillRect: () => { },
        };
    });
    return canvas;
}
export function mockWebGLRenderer() {
    const canvas = mockCanvasElement();
    const renderer = {
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
            reset: () => { },
            update: () => { },
        },
        render: () => { },
        setSize: (width, height) => {
            renderer.width = width;
            renderer.height = height;
        },
        dispose: () => { },
        setScissor: () => { },
        setScissorTest: () => { },
        setViewport: () => { },
        clear: () => { },
        getPixelRatio: () => 1,
        setPixelRatio: () => { },
    };
    return renderer;
}
export function mockCamera() {
    const camera = new THREE.Camera();
    camera.getWorldDirection = () => new THREE.Vector3(0, 0, -1);
    return camera;
}
export function mockPerspectiveCamera(fov = 75, aspect = 1, near = 0.1, far = 1000) {
    return new THREE.PerspectiveCamera(fov, aspect, near, far);
}
export function mockGroup() {
    return new THREE.Group();
}
export function mockVector3(x = 0, y = 0, z = 0) {
    return new THREE.Vector3(x, y, z);
}
export function mockBox3(min, max) {
    const minVec = Option.getOrElse(Option.fromNullable(min), () => new THREE.Vector3(0, 0, 0));
    const maxVec = Option.getOrElse(Option.fromNullable(max), () => new THREE.Vector3(1, 1, 1));
    return new THREE.Box3(minVec, maxVec);
}
export function isMockScene(obj) {
    return obj instanceof THREE.Scene;
}
export function isMockMesh(obj) {
    return obj instanceof THREE.Mesh;
}
export function isMockTexture(obj) {
    return obj instanceof THREE.Texture;
}
export function isMockMaterial(obj) {
    return obj instanceof THREE.Material;
}
//# sourceMappingURL=../../dist/test/helpers/three-mocks.js.map