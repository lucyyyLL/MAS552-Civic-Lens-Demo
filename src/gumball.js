// Rhino-style gumball for placed objects. The red and green arrows move the selected object along
// the ground's two axes, the white square moves it freely on the ground, and the blue ring
// rotates it around its vertical axis. tap-place selects objects through select().

const SCREEN_SIZE = 0.18  // gumball size as a fraction of its distance to the camera

// Unlit and drawn on top of everything, so handles stay visible inside or behind models
const handleMaterial = color => new THREE.MeshBasicMaterial({
  color, depthTest: false, transparent: true, opacity: 0.9,
})

// Builds the gumball at unit size. Each handle is a visible mesh plus a larger invisible twin
// that is easier to hit with a finger; both record which drag they start in userData.handle.
const buildGumball = () => {
  const group = new THREE.Group()
  const addHandle = (handle, color, geometry, hitGeometry, place) => {
    const mesh = new THREE.Mesh(geometry, handleMaterial(color))
    const hitArea = new THREE.Mesh(hitGeometry)
    hitArea.visible = false  // raycasting still hits invisible meshes
    for (const m of [mesh, hitArea]) {
      m.userData.handle = handle
      m.renderOrder = 999
      place(m)
      group.add(m)
    }
  }

  // Arrows along +X (red) and +Z (green). Cylinders and cones are built along +Y, so turn them.
  for (const [axis, color, turn] of [
    ['x', 0xe53935, m => { m.rotation.z = -Math.PI / 2 }],
    ['z', 0x43a047, m => { m.rotation.x = Math.PI / 2 }],
  ]) {
    addHandle(axis, color, new THREE.CylinderGeometry(0.02, 0.02, 0.8), new THREE.CylinderGeometry(0.1, 0.1, 0.8),
      m => { turn(m); m.position[axis] = 0.45 })
    addHandle(axis, color, new THREE.ConeGeometry(0.07, 0.2), new THREE.ConeGeometry(0.14, 0.25),
      m => { turn(m); m.position[axis] = 0.95 })
  }

  // Rotation ring lying flat around the object, outside the arrow tips so their hit areas don't overlap
  addHandle('rotate', 0x1e88e5, new THREE.TorusGeometry(1.3, 0.02, 8, 96), new THREE.TorusGeometry(1.3, 0.09, 8, 96),
    m => { m.rotation.x = Math.PI / 2 })

  // Free-move square between the two arrows
  addHandle('free', 0xffffff, new THREE.PlaneGeometry(0.18, 0.18), new THREE.PlaneGeometry(0.3, 0.3),
    m => { m.rotation.x = -Math.PI / 2; m.position.set(0.2, 0, 0.2) })

  return group
}

// Angle of a ground point around a center, matching the direction of rotation.y
const angleAround = (point, center) => Math.atan2(point.x - center.x, point.z - center.z)

export const gumballComponent = {
  init() {
    this.target = null  // the selected entity
    this.drag = null    // the handle being dragged and the state when the drag began
    this.gizmo = buildGumball()
    this.gizmo.visible = false
    this.el.object3D.add(this.gizmo)

    this.raycaster = new THREE.Raycaster()
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))  // horizontal plane at the object's base
    this.cameraPosition = new THREE.Vector3()

    // Listen in the capture phase on window, so a press on a handle is claimed before A-Frame's
    // cursor (which would count it as a tap) and 8th Wall's desktop camera controls see it
    window.addEventListener('pointerdown', this.onPointerDown.bind(this), true)
    window.addEventListener('pointermove', this.onPointerMove.bind(this), true)
    window.addEventListener('pointerup', this.onPointerUp.bind(this), true)
    // Touch events arrive separately from pointer events; keep them from the cursor mid-drag
    window.addEventListener('touchstart', (event) => {
      if (this.drag) {
        event.stopPropagation()
        event.preventDefault()  // no page scrolling while dragging
      }
    }, {capture: true, passive: false})
  },

  // Shows the gumball on an entity, or hides it when passed null
  select(el) {
    this.target = el
    this.gizmo.visible = !!el
  },

  tick() {
    if (!this.target) return
    const {position} = this.target.object3D
    this.gizmo.position.copy(position)
    // Keep a constant size on screen, like Rhino's gumball
    this.el.camera.getWorldPosition(this.cameraPosition)
    this.gizmo.scale.setScalar(this.cameraPosition.distanceTo(position) * SCREEN_SIZE)
  },

  // Aims the raycaster through the pointer's position on the canvas
  aimAt(event) {
    const rect = this.el.canvas.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(pointer, this.el.camera)
  },

  // The point on the drag plane under the pointer, or null if the pointer is above the horizon
  pointOnPlane(event) {
    this.aimAt(event)
    return this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3())
  },

  onPointerDown(event) {
    if (!this.target || event.target !== this.el.canvas) return
    this.gizmo.updateMatrixWorld()  // tick() may have resized it since the last frame
    this.aimAt(event)
    const hit = this.raycaster.intersectObject(this.gizmo, true)[0]
    if (!hit) return

    // Claim the press. preventDefault also suppresses the mouse events that would follow it.
    event.stopPropagation()
    event.preventDefault()

    const object = this.target.object3D
    this.plane.constant = -object.position.y
    const start = this.pointOnPlane(event)
    if (!start) return
    this.drag = {
      handle: hit.object.userData.handle,
      start,
      position: object.position.clone(),
      startAngle: angleAround(start, object.position),
      rotationY: object.rotation.y,
    }
  },

  onPointerMove(event) {
    if (!this.drag) return
    event.stopPropagation()
    const point = this.pointOnPlane(event)
    if (!point) return

    const {handle, start, position, startAngle, rotationY} = this.drag
    const object = this.target.object3D

    if (handle === 'rotate') {
      object.rotation.y = rotationY + angleAround(point, position) - startAngle
      return
    }
    // Move by how far the pointer travelled on the plane, limited to one axis for the arrows
    const offset = point.sub(start)
    if (handle === 'x') offset.z = 0
    if (handle === 'z') offset.x = 0
    object.position.copy(position).add(offset)
  },

  onPointerUp(event) {
    if (!this.drag) return
    event.stopPropagation()
    this.drag = null
  },
}
