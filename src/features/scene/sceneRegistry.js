// Runtime Three objects stay outside serializable project state.
export const SCENE_OBJECT_REFS = new Map()
export const MODEL_NODE_REFS = new Map()

export function indexModelNodes(root) {
  const nodes = new Map()
  const visit = (parent, prefix = '') => parent.children.forEach((child, index) => {
    const segment = `${child.name || child.type || 'Object'}[${index}]`
    const path = prefix ? `${prefix}/${segment}` : segment
    nodes.set(path, child)
    visit(child, path)
  })
  visit(root)
  return nodes
}
