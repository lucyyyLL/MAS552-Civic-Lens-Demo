// Places a new object with the current "brush" model wherever the ground is tapped. While an
// object is selected, tapping the ground deselects it instead. Placement waits until the shared
// site is anchored; the object is saved and shown by the shared-objects component.
// The brush (model URL, upright rotation, real-world height, prompt, credit) is set by prompt-ui.

export const tapPlaceComponent = {
  schema: {
    modelUrl: {default: ''},
    upright: {type: 'vec3'},  // rotation in degrees that stands the model upright
    height: {default: 1},     // target height of the placed model, in meters
    prompt: {default: ''},
    attribution: {default: ''},
  },

  init() {
    const status = document.getElementById('status')
    const frame = document.getElementById('siteFrame').object3D

    document.getElementById('ground').addEventListener('click', (event) => {
      const {gumball, 'site-anchor': anchor, 'shared-objects': objects} = this.el.components
      if (!anchor.anchored) return
      if (gumball.target) {
        gumball.select(null)
        return
      }
      if (!this.data.modelUrl) {
        status.textContent = 'Describe an object first'
        return
      }
      // The raycaster gives the tap's location in world space; convert it to site meters
      const position = frame.worldToLocal(event.detail.intersection.point.clone())
      objects.create(position, this.data).catch((err) => {
        status.textContent = `Could not place it: ${err.message}`
      })
    })
  },
}
