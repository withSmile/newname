import * as THREE from 'three'

export const CAMERA_VIEWS = {
  perspective: { label: '自由视角', direction: [1, 0.75, 1] },
  front: { label: '前视图', direction: [0, 0, 1] },
  back: { label: '后视图', direction: [0, 0, -1] },
  left: { label: '左视图', direction: [-1, 0, 0] },
  right: { label: '右视图', direction: [1, 0, 0] },
  top: { label: '顶视图', direction: [0, 1, 0.0001] },
  bottom: { label: '底视图', direction: [0, -1, 0.0001] },
}

// Fit a bounding sphere against both viewport dimensions, including portrait views.
export function fitBounds(camera, bounds, direction) {
  if (bounds.isEmpty()) return null
  const center = bounds.getCenter(new THREE.Vector3())
  const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.1)
  const unit = direction.clone().normalize()
  if (!unit.lengthSq()) unit.set(1, 0.75, 1).normalize()
  let distance = Math.max(camera.position.distanceTo(center), radius * 2, 1)
  let zoom = camera.zoom
  if (camera.isPerspectiveCamera) {
    const vertical = THREE.MathUtils.degToRad(camera.getEffectiveFOV())
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect)
    distance = Math.max(radius * 1.2 / Math.sin(Math.min(vertical, horizontal) / 2), camera.near + radius)
  } else if (camera.isOrthographicCamera) {
    zoom = Math.min(camera.right - camera.left, camera.top - camera.bottom) / (radius * 2.4)
  }
  return { target: center, position: center.clone().addScaledVector(unit, distance), zoom }
}
