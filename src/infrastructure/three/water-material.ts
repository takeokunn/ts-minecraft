import * as THREE from 'three'

type WaterUniform<T> = { value: T }

export type WaterMaterialUniforms = {
  readonly uTime: WaterUniform<number>
  readonly uRefractionMap: WaterUniform<THREE.Texture>
  readonly uCameraPosition: WaterUniform<THREE.Vector3>
  readonly uResolution: WaterUniform<THREE.Vector2>
  readonly uRefractionValid: WaterUniform<boolean>
}

export type WaterMaterial = THREE.ShaderMaterial & {
  readonly uniforms: WaterMaterialUniforms
}

const WATER_VERT = /* glsl */`
precision mediump float;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  // No vertex displacement — greedy-meshed quads have only 4 vertices per face,
  // so Y-displacement creates visible polygon warping rather than smooth waves.
  // All animation is done in the fragment shader instead.
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xyz;
  // normalMatrix is a Three.js built-in uniform available on all ShaderMaterials.
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`

const WATER_FRAG = /* glsl */`
precision mediump float;
uniform float uTime;
uniform sampler2D uRefractionMap;
uniform vec3 uCameraPosition;
uniform vec2 uResolution;
uniform bool uRefractionValid;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

// Parabolic sin approximation: 4x(1-|x|) normalized to [-π,π] range
// Max error ~0.056 — imperceptible for water distortion
float fastSin(float x) {
  x = mod(x, 6.2831853) - 3.1415926;
  float ax = abs(x);
  return x * (1.2732395 - 0.4052847 * ax);
}
float fastCos(float x) {
  return fastSin(x + 1.5707963);
}

void main() {
  vec2 screenUV = gl_FragCoord.xy / uResolution;

  // Two-layer ripple at different frequencies and speeds — gives natural-looking motion
  // without requiring geometry tessellation.
  float s = 0.014;
  vec2 distort = vec2(
    fastSin(vWorldPos.z * 3.0 + uTime * 1.8) * s + fastSin(vWorldPos.x * 2.0 + uTime * 0.9) * s * 0.5,
    fastCos(vWorldPos.x * 3.0 + uTime * 1.6) * s + fastCos(vWorldPos.z * 2.0 + uTime * 1.1) * s * 0.5
  );

  vec3 viewDir = normalize(uCameraPosition - vWorldPos);
  vec3 n = normalize(vNormal);
  // Schlick-style Fresnel approximation: x*x*x ≈ pow(x, 2.6) — saves a GPU transcendental
  float NdotV = 1.0 - max(dot(viewDir, n), 0.0);
  float fresnel = NdotV * NdotV * NdotV;

  vec4 shallowColor = vec4(0.10, 0.42, 0.64, 0.84);
  vec4 deepColor = vec4(0.02, 0.16, 0.40, 0.92);
  float depthFactor = clamp(0.45 + fresnel * 0.35, 0.0, 1.0);
  vec4 waterTint = mix(shallowColor, deepColor, depthFactor);

  // Approximate sky reflection — replaces SSR post-processing pass.
  // Reflect the view direction across the perturbed normal to get a sky sample direction.
  // skyFactor maps the reflected Y component to [0,1]: looking up = bright sky, down = dark horizon.
  vec3 reflectDir = reflect(-viewDir, n);
  float skyFactor = clamp(reflectDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 skyColor = mix(vec3(0.6, 0.7, 0.9), vec3(0.3, 0.5, 0.85), skyFactor);

  // Fresnel-weighted blend: at glancing angles show more sky reflection,
  // at steep angles show more refraction / water tint.
  // Skip refraction texture fetch when uRefractionValid is false (startup frames).
  vec4 refracted = uRefractionValid
    ? texture2D(uRefractionMap, screenUV + distort)
    : waterTint;
  vec4 color = uRefractionValid
    ? mix(refracted, vec4(mix(skyColor, waterTint.rgb, 0.5), waterTint.a), fresnel * 0.45 + 0.12)
    : vec4(mix(skyColor, waterTint.rgb, 0.3), waterTint.a);
  color.a = 0.86;

  gl_FragColor = color;
}
`

export const createWaterMaterial = (
  refractionTexture: THREE.Texture,
  width: number,
  height: number
): WaterMaterial => {
  const uniforms = {
    uTime: { value: 0.0 },
    uRefractionMap: { value: refractionTexture },
    uCameraPosition: { value: new THREE.Vector3() },
    uResolution: { value: new THREE.Vector2(width, height) },
    uRefractionValid: { value: false },
  } satisfies WaterMaterialUniforms

  return Object.assign(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  }), { uniforms })
}
