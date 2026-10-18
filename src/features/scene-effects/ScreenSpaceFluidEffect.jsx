import { useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
uniform float uTime;
uniform float uSpeed;
uniform float uPointSize;
uniform float uSpread;
attribute float aSeed;
varying float vSeed;
varying float vDepthFade;

void main() {
  vSeed = aSeed;
  vec3 animated = position;
  float phase = aSeed * 18.8496 + uTime * uSpeed;
  animated.x += sin(phase * 1.3 + position.y * 2.0) * 0.16 * uSpread;
  animated.z += cos(phase * 1.1 + position.y * 1.6) * 0.16 * uSpread;
  animated.y += sin(phase * 0.7) * 0.12;
  vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = clamp(uPointSize * (260.0 / max(1.0, -viewPosition.z)), 3.0, 96.0);
  vDepthFade = smoothstep(26.0, 2.0, -viewPosition.z);
}
`

const fragmentShader = `
uniform vec3 uColor;
uniform vec3 uSecondary;
uniform float uOpacity;
uniform float uStrength;
varying float vSeed;
varying float vDepthFade;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float radius2 = dot(point, point);
  if (radius2 > 1.0) discard;
  vec3 normal = normalize(vec3(point, sqrt(max(0.0, 1.0 - radius2))));
  vec3 lightDirection = normalize(vec3(-0.35, 0.72, 0.58));
  float diffuse = 0.25 + max(dot(normal, lightDirection), 0.0) * 0.8;
  float fresnel = pow(1.0 - normal.z, 2.4);
  float specular = pow(max(dot(reflect(-lightDirection, normal), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float thickness = pow(max(0.0, normal.z), 0.65);
  vec3 liquid = mix(uSecondary, uColor, thickness * 0.75 + fract(vSeed * 17.0) * 0.12);
  liquid *= diffuse;
  liquid += vec3(0.72, 0.9, 1.0) * (fresnel * 0.65 + specular * uStrength * 1.8);
  float edge = smoothstep(1.0, 0.72, radius2);
  float alpha = edge * uOpacity * vDepthFade * (0.48 + thickness * 0.52);
  gl_FragColor = vec4(liquid, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function createFluidGeometry(count, spread) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const seed = (index * 0.61803398875) % 1
    const angle = seed * Math.PI * 2 * 7
    const layer = ((index * 37) % count) / count
    const radius = Math.sqrt(layer) * spread * (0.38 + (index % 11) / 18)
    positions[index * 3] = Math.cos(angle) * radius
    positions[index * 3 + 1] = 0.35 + layer * spread * 1.15 + Math.sin(angle * 1.7) * 0.16
    positions[index * 3 + 2] = Math.sin(angle) * radius
    seeds[index] = seed
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  geometry.computeBoundingSphere()
  return geometry
}

export function ScreenSpaceFluidEffect({ settings }) {
  const materialRef = useRef()
  const count = THREE.MathUtils.clamp(Math.round(settings.fluidCount ?? 900), 100, 2600)
  const spread = Math.max(0.4, settings.fluidSpread ?? 2.4)
  const geometry = useMemo(() => createFluidGeometry(count, spread), [count, spread])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }) => {
    const uniforms = materialRef.current?.uniforms
    if (!uniforms) return
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uSpeed.value = settings.speed ?? 0.8
    uniforms.uPointSize.value = settings.fluidPointSize ?? 0.34
    uniforms.uSpread.value = spread
    uniforms.uColor.value.set(settings.color || '#25b9ff')
    uniforms.uSecondary.value.set(settings.fluidSecondary || '#083d72')
    uniforms.uOpacity.value = settings.fluidOpacity ?? 0.72
    uniforms.uStrength.value = settings.strength ?? 0.9
  })
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: settings.speed ?? 0.8 },
    uPointSize: { value: settings.fluidPointSize ?? 0.34 },
    uSpread: { value: spread },
    uColor: { value: new THREE.Color(settings.color || '#25b9ff') },
    uSecondary: { value: new THREE.Color(settings.fluidSecondary || '#083d72') },
    uOpacity: { value: settings.fluidOpacity ?? 0.72 },
    uStrength: { value: settings.strength ?? 0.9 },
  }), [])
  return <points position={settings.position || [0, 0, 0]} geometry={geometry} frustumCulled={false} userData={{ sceneEffectHelper: true }}>
    <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} depthTest blending={THREE.NormalBlending} />
  </points>
}
