import React, { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODEL_NODE_REFS } from '../sceneRegistry'
import { useModelSelection } from './modelSelectionStore'
import { useEditor } from '../../../store'

export function ModelSelectionRuntime() {
  const selection = useModelSelection()
  const selectedId = useEditor((state) => state.selectedId)
  const helper = useMemo(() => {
    const result = new THREE.Box3Helper(new THREE.Box3(), '#e77b52')
    result.material.depthTest = false
    result.renderOrder = 1000
    result.raycast = () => null
    result.visible = false
    return result
  }, [])
  useEffect(() => { if (selection.objectId && selection.objectId !== selectedId) selection.clear() }, [selectedId, selection.objectId, selection.clear])
  useEffect(() => () => { helper.geometry.dispose(); helper.material.dispose() }, [helper])
  useFrame(() => {
    const node = MODEL_NODE_REFS.get(selection.objectId)?.get(selection.path)
    let visible = Boolean(node)
    for (let parent = node; parent; parent = parent.parent) if (!parent.visible) visible = false
    helper.visible = visible
    if (visible) { helper.box.setFromObject(node); helper.visible = !helper.box.isEmpty() }
  })
  return <primitive object={helper} dispose={null} />
}
