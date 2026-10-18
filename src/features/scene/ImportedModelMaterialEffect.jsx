import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const MODEL_EFFECT_TYPES = new Set(['hologram', 'fresnel', 'xray', 'scan', 'dissolve'])

const vertexPars = `
varying vec3 vModelEffectNormal;
varying vec3 vModelEffectWorldPosition;
varying vec3 vModelEffectViewDirection;
varying vec3 vModelEffectLocalPosition;
`

const vertexMain = `
vec4 modelEffectWorldPosition = modelMatrix * vec4(transformed, 1.0);
vModelEffectWorldPosition = modelEffectWorldPosition.xyz;
vModelEffectNormal = normalize(mat3(modelMatrix) * objectNormal);
vModelEffectViewDirection = normalize(cameraPosition - modelEffectWorldPosition.xyz);
vModelEffectLocalPosition = position;
`

const fragmentPars = `
uniform float uModelEffectTime;
uniform float uModelEffectIntensity;
uniform float uModelEffectScale;
uniform float uModelEffectOpacity;
uniform float uModelEffectType;
uniform vec3 uModelEffectColor;
uniform float uModelEffectProgress;
uniform float uModelEffectEdgeWidth;
varying vec3 vModelEffectNormal;
varying vec3 vModelEffectWorldPosition;
varying vec3 vModelEffectViewDirection;
varying vec3 vModelEffectLocalPosition;

float modelEffectHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float modelEffectNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(modelEffectHash(i), modelEffectHash(i + vec3(1,0,0)), f.x), mix(modelEffectHash(i + vec3(0,1,0)), modelEffectHash(i + vec3(1,1,0)), f.x), f.y), mix(mix(modelEffectHash(i + vec3(0,0,1)), modelEffectHash(i + vec3(1,0,1)), f.x), mix(modelEffectHash(i + vec3(0,1,1)), modelEffectHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`

const fragmentMain = `
float modelEffectFresnel = pow(1.0 - clamp(abs(dot(normalize(vModelEffectNormal), normalize(vModelEffectViewDirection))), 0.0, 1.0), 2.4);
float modelEffectMask = modelEffectFresnel;
if (uModelEffectType < 0.5) {
  float scanLines = pow(0.5 + 0.5 * sin((vModelEffectWorldPosition.y + uModelEffectTime * 0.45) * uModelEffectScale * 8.0), 7.0);
  float flicker = 0.82 + 0.18 * sin(uModelEffectTime * 11.0 + vModelEffectWorldPosition.y * 4.0);
  modelEffectMask = (modelEffectFresnel * 1.35 + scanLines * 0.55 + 0.08) * flicker;
} else if (uModelEffectType < 1.5) {
  modelEffectMask = modelEffectFresnel * 1.6;
} else if (uModelEffectType < 2.5) {
  float xrayPulse = 0.75 + 0.25 * sin(uModelEffectTime * 2.0);
  modelEffectMask = (0.28 + modelEffectFresnel * 1.45) * xrayPulse;
} else if (uModelEffectType < 3.5) {
  float scanPosition = fract(vModelEffectWorldPosition.y * 0.08 + uModelEffectTime * 0.18);
  float scanBand = smoothstep(0.08, 0.0, abs(scanPosition - 0.5));
  modelEffectMask = modelEffectFresnel * 0.75 + scanBand * 2.2;
} else {
  float dissolveNoise = modelEffectNoise(vModelEffectLocalPosition * uModelEffectScale + uModelEffectTime * 0.08);
  float dissolveField = vModelEffectLocalPosition.y * 0.35 + dissolveNoise * 0.65 + 0.5;
  float dissolveThreshold = uModelEffectProgress * 1.5 - 0.15;
  float dissolveDistance = dissolveField - dissolveThreshold;
  if (dissolveDistance < 0.0) discard;
  modelEffectMask = 1.0 - smoothstep(0.0, max(0.005, uModelEffectEdgeWidth), dissolveDistance);
}
totalEmissiveRadiance += uModelEffectColor * modelEffectMask * uModelEffectIntensity;
diffuseColor.a *= uModelEffectOpacity;
`

export const shaderType = (type) => ({ hologram: 0, fresnel: 1, xray: 2, scan: 3, dissolve: 4 }[type] ?? 0)

export function injectModelEffectShader(shader, effect) {
  shader.uniforms.uModelEffectTime = { value: 0 }
  shader.uniforms.uModelEffectIntensity = { value: effect?.intensity ?? 1.2 }
  shader.uniforms.uModelEffectScale = { value: effect?.scale ?? 7 }
  shader.uniforms.uModelEffectOpacity = { value: effect?.opacity ?? 1 }
  shader.uniforms.uModelEffectType = { value: shaderType(effect?.type) }
  shader.uniforms.uModelEffectColor = { value: new THREE.Color(effect?.color || '#38d9ff') }
  shader.uniforms.uModelEffectProgress = { value: effect?.progress ?? 0.45 }
  shader.uniforms.uModelEffectEdgeWidth = { value: effect?.edgeWidth ?? 0.12 }
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${vertexPars}`).replace('#include <worldpos_vertex>', `#include <worldpos_vertex>${vertexMain}`)
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>${fragmentPars}`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${fragmentMain}`)
  return shader
}

export function updateModelEffectShader(shader, effect, elapsedTime) {
  if (!shader) return
  shader.uniforms.uModelEffectTime.value = elapsedTime * (effect?.speed ?? 1)
  shader.uniforms.uModelEffectIntensity.value = effect?.intensity ?? 1.2
  shader.uniforms.uModelEffectScale.value = effect?.scale ?? 7
  shader.uniforms.uModelEffectOpacity.value = effect?.opacity ?? 1
  shader.uniforms.uModelEffectType.value = shaderType(effect?.type)
  shader.uniforms.uModelEffectColor.value.set(effect?.color || '#38d9ff')
  shader.uniforms.uModelEffectProgress.value = effect?.progress ?? 0.45
  shader.uniforms.uModelEffectEdgeWidth.value = effect?.edgeWidth ?? 0.12
}

export function ImportedModelMaterialEffect({ root, effect }) {
  const enabled = Boolean(effect?.enabled && MODEL_EFFECT_TYPES.has(effect?.type))

  useEffect(() => {
    if (!root || !enabled) return undefined
    const restorers = []
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (!material?.isMeshStandardMaterial && !material?.isMeshPhysicalMaterial) return
        const previous = {
          onBeforeCompile: material.onBeforeCompile,
          customProgramCacheKey: material.customProgramCacheKey,
          transparent: material.transparent,
          opacity: material.opacity,
          depthWrite: material.depthWrite,
          side: material.side,
          userDataEffectShader: material.userData.modelEffectShader,
        }
        material.onBeforeCompile = (shader, renderer) => {
          previous.onBeforeCompile?.call(material, shader, renderer)
          material.userData.modelEffectShader = injectModelEffectShader(shader, effect)
        }
        material.customProgramCacheKey = () => `model-effect-${effect?.type || 'none'}-v2`
        material.transparent = enabled && (effect?.opacity ?? 1) < 0.999
        material.opacity = enabled ? effect?.opacity ?? 1 : previous.opacity
        material.depthWrite = !enabled || (effect?.type !== 'hologram' && effect?.type !== 'xray' && (effect?.opacity ?? 1) >= 0.999)
        material.side = enabled && effect?.type === 'xray' ? THREE.DoubleSide : previous.side
        material.needsUpdate = true
        restorers.push(() => {
          material.onBeforeCompile = previous.onBeforeCompile
          material.customProgramCacheKey = previous.customProgramCacheKey
          material.transparent = previous.transparent
          material.opacity = previous.opacity
          material.depthWrite = previous.depthWrite
          material.side = previous.side
          material.userData.modelEffectShader = previous.userDataEffectShader
          material.needsUpdate = true
        })
      })
    })
    return () => restorers.forEach((restore) => restore())
  }, [root, enabled, effect?.type])

  useFrame((state) => {
    if (!root || !enabled) return
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        const shader = material.userData.modelEffectShader
        if (!shader) return
        updateModelEffectShader(shader, effect, state.clock.elapsedTime)
      })
    })
  })

  return null
}
