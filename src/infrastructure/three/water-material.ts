import * as THREE from 'three'

const WATER_VERT = /* glsl */`
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  // No vertex displacement — greedy-meshed quads have only 4 vertices per face,
  // so Y-displacement creates visible polygon warping rather than smooth waves.
  // All animation is done in the fragment shader instead.
  vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xyz;
  // Compute normal matrix manually — Three.js only injects normalMatrix when lights:true,
  // which we deliberately avoid (water doesn't need the full lighting pipeline).
  mat3 normalMat = mat3(transpose(inverse(modelMatrix)));
  vNormal = normalize(normalMat * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos4;
}
`

const WATER_FRAG = /* glsl */`
uniform float uTime;
uniform sampler2D uRefractionMap;
uniform vec3 uCameraPosition;
uniform vec2 uResolution;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vec2 screenUV = gl_FragCoord.xy / uResolution;

  // Two-layer ripple at different frequencies and speeds — gives natural-looking motion
  // without requiring geometry tessellation.
  float s = 0.014;
  vec2 distort = vec2(
    sin(vWorldPos.z * 3.0 + uTime * 1.8) * s + sin(vWorldPos.x * 2.0 + uTime * 0.9) * s * 0.5,
    cos(vWorldPos.x * 3.0 + uTime * 1.6) * s + cos(vWorldPos.z * 2.0 + uTime * 1.1) * s * 0.5
  );

  vec4 refracted = texture2D(uRefractionMap, screenUV + distort);

  vec3 viewDir = normalize(uCameraPosition - vWorldPos);
  vec3 n = normalize(vNormal);
  float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 2.6);

  vec4 shallowColor = vec4(0.10, 0.42, 0.64, 0.84);
  vec4 deepColor = vec4(0.02, 0.16, 0.40, 0.92);
  float depthFactor = clamp(0.45 + fresnel * 0.35, 0.0, 1.0);
  vec4 waterTint = mix(shallowColor, deepColor, depthFactor);

  vec4 color = mix(refracted, waterTint, clamp(fresnel * 0.38 + 0.18, 0.0, 1.0));
  color.a = 0.86;

  gl_FragColor = color;
}
`

export const createWaterMaterial = (
  refractionTexture: THREE.Texture,
  width: number,
  height: number
): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uRefractionMap: { value: refractionTexture },
      uCameraPosition: { value: new THREE.Vector3() },
      uResolution: { value: new THREE.Vector2(width, height) },
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  })
