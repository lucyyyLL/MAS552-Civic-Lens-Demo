// Places a copy of the current "brush" model wherever the ground is tapped, and selects placed
// objects for the gumball when they are tapped. While an object is selected, tapping the ground
// deselects it instead of placing a new one. Placement waits until the shared site is anchored.
// Objects are added to #siteFrame, so their position, rotation and scale are in site meters.
// The brush (model URL, upright rotation, real-world height) is set by the prompt-ui component.

export const tapPlaceComponent = {
  schema: {
    modelUrl: {default: ''},
    upright: {type: 'vec3'},  // rotation in degrees that stands the model upright
    height: {default: 1},     // target height of the placed model, in meters
  },

  init() {
    this.status = document.getElementById('status')
    this.frame = document.getElementById('siteFrame')

    document.getElementById('ground').addEventListener('click', (event) => {
      const {gumball, 'site-anchor': anchor} = this.el.components
      if (!anchor.anchored) return
      if (gumball.target) {
        gumball.select(null)
        return
      }
      if (!this.data.modelUrl) {
        this.status.textContent = 'Describe an object first'
        return
      }
      // The raycaster gives the tap's location in world space; convert it to site meters
      this.place(this.frame.object3D.worldToLocal(event.detail.intersection.point.clone()))
    })
  },

  place(position) {
    const el = document.createElement('a-entity')
    const {upright, height} = this.data

    // Stay hidden at scale 1 with no rotation until the model is measured
    el.setAttribute('position', position)
    el.setAttribute('visible', 'false')
    el.setAttribute('shadow', {receive: false})
    el.setAttribute('gltf-model', this.data.modelUrl)

    el.addEventListener('model-loaded', () => {
      const scale = normalize(el, upright, height)

      // Pop the model in with an elastic scale animation
      el.setAttribute('scale', '0.0001 0.0001 0.0001')
      el.setAttribute('visible', 'true')
      el.setAttribute('animation', {
        property: 'scale',
        to: `${scale} ${scale} ${scale}`,
        easing: 'easeOutElastic',
        dur: 800,
      })

      // Make the object tappable (the camera's raycaster targets .cantap) to select it
      el.classList.add('cantap')
      el.addEventListener('click', () => this.el.components.gumball.select(el))
    })
    el.addEventListener('model-error', () => {
      this.status.textContent = 'Could not load that model'
      el.remove()
    })

    this.frame.appendChild(el)
  },
}

// Models from different sources use arbitrary units, origins and up axes. This stands the mesh
// upright, centers it on its entity, rests its base on the entity's origin, and returns the
// uniform scale that makes it `height` meters tall. The bounding box is measured in the entity's
// own space, which matches site meters because the entity is still at scale 1 with no rotation.
const normalize = (el, upright, height) => {
  const mesh = el.getObject3D('mesh')
  const toRad = THREE.MathUtils.degToRad
  mesh.rotation.set(toRad(upright.x), toRad(upright.y), toRad(upright.z))

  el.object3D.updateMatrixWorld(true)
  const toEntity = el.object3D.matrixWorld.clone().invert()
  const box = new THREE.Box3()
  mesh.traverse((child) => {
    if (!child.geometry) return
    child.geometry.computeBoundingBox()
    const matrix = toEntity.clone().multiply(child.matrixWorld)
    box.union(child.geometry.boundingBox.clone().applyMatrix4(matrix))
  })
  const center = box.getCenter(new THREE.Vector3())

  mesh.position.x -= center.x
  mesh.position.z -= center.z
  mesh.position.y -= box.min.y

  return height / (box.max.y - box.min.y)
}
