import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditor } from '../../store'
import { usePhysicsRuntime } from './physicsStore'

const colliderFor = (RAPIER, world, body, object) => {
  const size = object.physicsSize || [1, 1, 1]
  const type = object.colliderType || (object.type === 'sphere' ? 'ball' : object.type === 'capsule' ? 'capsule' : 'cuboid')
  let descriptor
  if (type === 'ball') descriptor = RAPIER.ColliderDesc.ball(Math.max(0.01, size[0] * 0.5))
  else if (type === 'capsule') descriptor = RAPIER.ColliderDesc.capsule(Math.max(0.01, size[1] * 0.25), Math.max(0.01, size[0] * 0.5))
  else if (type === 'cylinder') descriptor = RAPIER.ColliderDesc.cylinder(Math.max(0.01, size[1] * 0.5), Math.max(0.01, size[0] * 0.5))
  else descriptor = RAPIER.ColliderDesc.cuboid(Math.max(0.01, size[0] * 0.5), Math.max(0.01, size[1] * 0.5), Math.max(0.01, size[2] * 0.5))
  descriptor.setFriction(object.friction ?? 0.5).setRestitution(object.restitution ?? 0.1).setDensity(Math.max(0.001, object.density ?? 1)).setSensor(Boolean(object.physicsSensor)).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
  return world.createCollider(descriptor, body)
}

const vector = (value, fallback = [0, 0, 0]) => ({ x: value?.[0] ?? fallback[0], y: value?.[1] ?? fallback[1], z: value?.[2] ?? fallback[2] })

const createJoint = (RAPIER, world, body, object) => {
  const type = object.physicsJoint || 'none'
  if (type === 'none' || (object.physicsBodyType || 'dynamic') !== 'dynamic') return null
  const anchor = object.jointAnchor || [0, 0, 0]
  const axis = vector(object.jointAxis, [0, 1, 0])
  const fixedBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(object.position[0] + anchor[0], object.position[1] + anchor[1], object.position[2] + anchor[2]))
  const fixedAnchor = { x: 0, y: 0, z: 0 }
  const bodyAnchor = vector(anchor)
  let data
  if (type === 'revolute') data = RAPIER.JointData.revolute(fixedAnchor, bodyAnchor, axis)
  if (type === 'prismatic') data = RAPIER.JointData.prismatic(fixedAnchor, bodyAnchor, axis)
  if (type === 'rope') data = RAPIER.JointData.rope(Math.max(0.01, object.jointLength ?? 2), fixedAnchor, bodyAnchor)
  if (type === 'spring') data = RAPIER.JointData.spring(Math.max(0.01, object.jointLength ?? 1), Math.max(0, object.jointStiffness ?? 25), Math.max(0, object.jointDamping ?? 2), fixedAnchor, bodyAnchor)
  if (!data) return null
  const joint = world.createImpulseJoint(data, fixedBody, body, true)
  if (object.jointLimitsEnabled && joint.setLimits) joint.setLimits(object.jointLimitMin ?? -1, object.jointLimitMax ?? 1)
  if (object.jointMotorEnabled && joint.configureMotorVelocity) joint.configureMotorVelocity(object.jointMotorVelocity ?? 1, Math.max(0, object.jointMotorFactor ?? 1))
  return { joint, fixedBody }
}

export function PhysicsRuntime({ objectRefs }) {
  const [rapier, setRapier] = useState(null)
  const worldRef = useRef(null)
  const bodiesRef = useRef(new Map())
  const colliderObjectsRef = useRef(new Map())
  const eventQueueRef = useRef(null)
  const debugRef = useRef(null)
  const enabled = usePhysicsRuntime((state) => state.enabled)
  const debug = usePhysicsRuntime((state) => state.debug)
  const gravity = usePhysicsRuntime((state) => state.gravity)
  const revision = usePhysicsRuntime((state) => state.revision)
  const command = usePhysicsRuntime((state) => state.command)
  const reportCollision = usePhysicsRuntime((state) => state.reportCollision)
  const physicsSignature = useEditor((state) => JSON.stringify(state.objects.filter((object) => object.physicsEnabled).map((object) => [object.id, object.physicsBodyType, object.colliderType, object.physicsSize, object.position, object.rotation, object.mass, object.friction, object.restitution, object.linearDamping, object.angularDamping, object.physicsSensor, object.gravityScale, object.ccdEnabled, object.lockTranslations, object.lockRotations, object.physicsJoint, object.jointAnchor, object.jointAxis, object.jointLength, object.jointStiffness, object.jointDamping, object.jointLimitsEnabled, object.jointLimitMin, object.jointLimitMax, object.jointMotorEnabled, object.jointMotorVelocity, object.jointMotorFactor])))

  useEffect(() => { let active = true; import('@dimforge/rapier3d-compat').then(async (module) => { const instance = module.default || module; await instance.init(); if (active) setRapier(instance) }); return () => { active = false } }, [])
  useEffect(() => {
    if (!rapier) return
    worldRef.current?.free()
    const world = new rapier.World({ x: gravity[0], y: gravity[1], z: gravity[2] })
    const groundBody = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0))
    const groundCollider = world.createCollider(rapier.ColliderDesc.cuboid(100, 0.05, 100).setFriction(0.8).setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS), groundBody)
    const bodies = new Map()
    const colliderObjects = new Map([[groundCollider.handle, '地面']])
    const quaternion = new THREE.Quaternion()
    useEditor.getState().objects.filter((object) => object.physicsEnabled).forEach((object) => {
      const bodyType = object.physicsBodyType || 'dynamic'
      const descriptor = bodyType === 'fixed' ? rapier.RigidBodyDesc.fixed() : bodyType === 'kinematic' ? rapier.RigidBodyDesc.kinematicPositionBased() : rapier.RigidBodyDesc.dynamic()
      quaternion.setFromEuler(new THREE.Euler(...object.rotation))
      descriptor.setTranslation(...object.position).setRotation(quaternion).setLinearDamping(object.linearDamping ?? 0.1).setAngularDamping(object.angularDamping ?? 0.1).setCanSleep(object.canSleep !== false).setGravityScale(object.gravityScale ?? 1)
      const body = world.createRigidBody(descriptor)
      if (bodyType === 'dynamic' && object.mass > 0) body.setAdditionalMass(object.mass, true)
      body.enableCcd(Boolean(object.ccdEnabled))
      const translationLocks = object.lockTranslations || [false, false, false]
      const rotationLocks = object.lockRotations || [false, false, false]
      body.setEnabledTranslations(!translationLocks[0], !translationLocks[1], !translationLocks[2], true)
      body.setEnabledRotations(!rotationLocks[0], !rotationLocks[1], !rotationLocks[2], true)
      const collider = colliderFor(rapier, world, body, object)
      colliderObjects.set(collider.handle, object.name || object.id)
      bodies.set(object.id, { body, bodyType, joint: createJoint(rapier, world, body, object) })
    })
    worldRef.current = world; bodiesRef.current = bodies; colliderObjectsRef.current = colliderObjects; eventQueueRef.current = new rapier.EventQueue(true)
    return () => { eventQueueRef.current?.free(); world.free(); if (worldRef.current === world) worldRef.current = null; bodiesRef.current = new Map(); colliderObjectsRef.current = new Map(); eventQueueRef.current = null }
  }, [rapier, physicsSignature, gravity.join(','), revision])

  useEffect(() => {
    if (!command) return
    const body = bodiesRef.current.get(command.objectId)?.body
    if (!body) return
    const value = vector(command.vector)
    if (command.type === 'impulse') body.applyImpulse(value, true)
    if (command.type === 'torque') body.applyTorqueImpulse(value, true)
    if (command.type === 'clear') { body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true) }
  }, [command])

  useFrame((_, delta) => {
    const world = worldRef.current
    if (!enabled || !world) return
    const objects = useEditor.getState().objects
    bodiesRef.current.forEach(({ body, bodyType }, id) => {
      const target = objectRefs.get(id); const object = objects.find((item) => item.id === id)
      if (!target || !object) return
      if (bodyType === 'kinematic') {
        body.setNextKinematicTranslation({ x: target.position.x, y: target.position.y, z: target.position.z })
        body.setNextKinematicRotation({ x: target.quaternion.x, y: target.quaternion.y, z: target.quaternion.z, w: target.quaternion.w })
      }
    })
    world.timestep = Math.min(1 / 30, delta)
    world.step(eventQueueRef.current)
    eventQueueRef.current?.drainCollisionEvents((firstHandle, secondHandle, started) => {
      if (!started) return
      const first = colliderObjectsRef.current.get(firstHandle) || `Collider ${firstHandle}`
      const second = colliderObjectsRef.current.get(secondHandle) || `Collider ${secondHandle}`
      reportCollision(first, second)
    })
    bodiesRef.current.forEach(({ body, bodyType }, id) => {
      if (bodyType === 'kinematic') return
      const target = objectRefs.get(id); if (!target) return
      const translation = body.translation(); const rotation = body.rotation()
      target.position.set(translation.x, translation.y, translation.z)
      target.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    })
    if (debug && debugRef.current) {
      const buffers = world.debugRender()
      const geometry = debugRef.current.geometry
      geometry.setAttribute('position', new THREE.BufferAttribute(buffers.vertices, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 4))
      geometry.computeBoundingSphere()
    }
  })
  return <lineSegments ref={debugRef} visible={debug} frustumCulled={false} renderOrder={1000}><bufferGeometry /><lineBasicMaterial vertexColors transparent opacity={0.82} depthTest={false} /></lineSegments>
}
