export const animationRuntimeSource = String.raw`const easing = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2,
}

const progressFor = (animation, elapsed) => {
  const duration = Math.max(0.05, animation.duration ?? 2)
  const local = elapsed - (animation.delay ?? 0)
  if (local < 0) return null
  if (!animation.loop && local > duration) return 1
  let cycle = animation.loop ? (local % duration) / duration : Math.min(1, local / duration)
  if (animation.direction === 'alternate' && Math.floor(local / duration) % 2) cycle = 1 - cycle
  if (animation.direction === 'reverse') cycle = 1 - cycle
  return (easing[animation.easing] || easing.easeInOut)(cycle)
}

const wave = (progress) => Math.sin(progress * Math.PI * 2)

export function createObjectAnimationUpdater(objects, nodes) {
  const keyframeCache = new Map(), materialState = new Map()
  return elapsed => { objects.forEach(object => {
    const animations = (object.animations || []).filter(animation => animation.enabled !== false)
    const target = nodes.get(object.id)?.node
    if (!target || !animations.length) return
      const position = new THREE.Vector3(...object.position)
      const rotation = new THREE.Euler(...object.rotation)
      const scale = new THREE.Vector3(...object.scale)
      let opacity = null
      let visible = object.visible !== false
      animations.forEach((animation) => {
        const progress = progressFor(animation, elapsed)
        if (progress === null) return
        const amount = animation.amount ?? 1
        const axis = animation.axis || 'y'
        if (animation.type === 'rotate') rotation[axis] += THREE.MathUtils.degToRad((animation.angle ?? 360) * progress)
        if (animation.type === 'float') position[axis] += wave(progress) * amount
        if (animation.type === 'move') position[axis] += amount * progress
        if (animation.type === 'pulse') scale.multiplyScalar(1 + Math.max(0, wave(progress)) * amount * 0.25)
        if (animation.type === 'fade') opacity = THREE.MathUtils.lerp(animation.from ?? 0.15, animation.to ?? 1, animation.direction === 'alternate' ? (wave(progress - 0.25) + 1) / 2 : progress)
        if (animation.type === 'blink') visible = progress < 0.5
        if (animation.type === 'keyframe') {
          const keyframes = animation.keyframes || []
          if (keyframes.length >= 2) {
            const signature = JSON.stringify([animation.channel, keyframes])
            let interpolant = keyframeCache.get(signature)
            if (!interpolant) {
              const Track = animation.channel === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack
              const values = animation.channel === 'rotation' ? keyframes.flatMap((frame) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...frame.value)).toArray()) : keyframes.flatMap((frame) => frame.value)
              const track = new Track('.value', keyframes.map((frame) => frame.time), values)
              interpolant = track.createInterpolant(); keyframeCache.set(signature, interpolant)
            }
            const sampleTime = progress * Math.max(0.05, animation.duration ?? keyframes[keyframes.length - 1].time)
            const value = interpolant.evaluate(sampleTime)
            if (animation.channel === 'position') position.fromArray(value)
            if (animation.channel === 'scale') scale.fromArray(value)
            if (animation.channel === 'rotation') rotation.setFromQuaternion(new THREE.Quaternion().fromArray(value))
          }
        }
      })
      target.position.copy(position); target.rotation.copy(rotation); target.scale.copy(scale); target.visible = visible
      if (opacity !== null) target.traverse?.((child) => {
        if (!child.isMesh) return
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.filter(Boolean).forEach((material) => {
          if (!materialState.has(material.uuid)) materialState.set(material.uuid, { opacity: material.opacity, transparent: material.transparent })
          material.transparent = true; material.opacity = opacity; material.needsUpdate = true
        })
      })

  }) }
}
`
