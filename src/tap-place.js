// Places a copy of the current "brush" model wherever the ground is tapped, and selects placed
// objects for the gumball when they are tapped. While an object is selected, tapping the ground
// deselects it instead of placing a new one.
// The brush (model URL, upright rotation, real-world height) is set by the prompt-ui component.

export const tapPlaceComponent = {
  schema: {
    modelUrl: {default: ''},
    upright: {type: 'vec3'},      // rotation in degrees that stands the model upright
    height: {default: 1},         // target height of the placed model, in meters
    unitsPerMeter: {default: 5},  // the camera starts at y = 8 units, roughly a phone held at ~1.6 m
  },

  init() {
    this.status = document.getElementById('status')

    document.getElementById('ground').addEventListener('click', (event) => {
      const {gumball} = this.el.components
      if (gumball.target) {
        gumball.select(null)
        return
      }
      if (!this.data.modelUrl) {
        this.status.textContent = 'Describe an object first'
        return
      }
      // The raycaster gives the location of the tap in the scene
      this.place(event.detail.intersection.point)
    })
  },

  place(point) {
    const el = document.createElement('a-entity')
    const {upright} = this.data
    const targetHeight = this.data.height * this.data.unitsPerMeter
    const yRotation = Math.random() * 360

    // Stay hidden at scale 1 with no rotation until the model is measured
    el.setAttribute('position', point)
    el.setAttribute('visible', 'false')
    el.setAttribute('shadow', {receive: false})
    el.setAttribute('gltf-model', this.data.modelUrl)

    el.addEventListener('model-loaded', () => {
      const scale = normalize(el, upright, targetHeight)

      // Pop the model in with an elastic scale animation
      el.setAttribute('rotation', `0 ${yRotation} 0`)
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

    this.el.sceneEl.appendChild(el)
  },
}

// Models from different sources use arbitrary units, origins and up axes. This stands the mesh
// upright, centers it on its entity, rests its base on the ground, and returns the uniform scale
// that makes it `targetHeight` tall. It must run while the entity is at scale 1 with no rotation.
const normalize = (el, upright, targetHeight) => {
  const mesh = el.getObject3D('mesh')
  const toRad = THREE.MathUtils.degToRad
  mesh.rotation.set(toRad(upright.x), toRad(upright.y), toRad(upright.z))

  el.object3D.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(mesh)
  const center = box.getCenter(new THREE.Vector3())
  const anchor = el.object3D.position

  mesh.position.x += anchor.x - center.x
  mesh.position.z += anchor.z - center.z
  mesh.position.y += anchor.y - box.min.y

  return targetHeight / (box.max.y - box.min.y)
}
