// Debug view for the shared site frame, enabled with ?debug=1:
// - axes and a 1 m grid at the site origin, plus three colored test markers at fixed site
//   positions, for comparing phones side by side without any backend
// - an outline of where the engine sees the target right now, with the target's own axes
// - a readout of the anchor's state

import {SITE} from './config/site'
import {SAMPLE_COUNT} from './site-anchor'

// Site-frame positions in meters
const MARKERS = [
  {position: [0, 0, 0.5], color: 0xe53935},
  {position: [0.5, 0, 0.5], color: 0x43a047},
  {position: [-0.5, 0, 1.0], color: 0x1e88e5},
]

// A 40 cm pin with a ball on top, standing on the ground
const buildMarker = (color) => {
  const material = new THREE.MeshBasicMaterial({color})
  const pin = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), material)
  pole.position.y = 0.2
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06), material)
  ball.position.y = 0.4
  pin.add(pole, ball)
  return pin
}

export const siteDebugComponent = {
  init() {
    if (!SITE.debug) return

    const frame = document.getElementById('siteFrame').object3D
    frame.add(new THREE.AxesHelper(1), new THREE.GridHelper(10, 10))
    for (const {position, color} of MARKERS) {
      const marker = buildMarker(color)
      marker.position.fromArray(position)
      frame.add(marker)
    }

    // Unit plane scaled to the target's size on every sighting. It should exactly cover the logo.
    this.outline = new THREE.Group()
    this.outlinePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({color: 0xffeb3b, transparent: true, opacity: 0.35, side: THREE.DoubleSide})
    )
    this.outlineAxes = new THREE.AxesHelper(1)
    this.outline.add(this.outlinePlane, this.outlineAxes)
    this.outline.visible = false
    this.el.object3D.add(this.outline)

    this.lastDetail = null
    const onSighting = ({detail}) => {
      if (detail.name !== SITE.targetName) return
      this.lastDetail = detail
      this.outline.visible = true
      this.outline.position.copy(detail.position)
      this.outline.quaternion.copy(detail.rotation)
      this.outline.scale.setScalar(detail.scale)
      this.outlinePlane.scale.set(detail.scaledWidth, detail.scaledHeight, 1)
      this.outlineAxes.scale.setScalar(Math.min(detail.scaledWidth, detail.scaledHeight) / 2)
    }
    this.el.addEventListener('xrimagefound', onSighting)
    this.el.addEventListener('xrimageupdated', onSighting)
    this.el.addEventListener('xrimagelost', () => { this.outline.visible = false })

    this.hud = document.createElement('pre')
    this.hud.id = 'siteHud'
    // Replaced every 250 ms once the camera runs; still showing means the camera never started
    this.hud.textContent = 'debug on: waiting for the camera…'
    document.body.appendChild(this.hud)
    this.nextHudUpdate = 0
  },

  tick(time) {
    if (!SITE.debug || time < this.nextHudUpdate) return
    this.nextHudUpdate = time + 250

    const anchor = this.el.components['site-anchor']
    const d = this.lastDetail
    const fmt = n => (n === null || n === undefined ? '–' : n.toFixed(4))
    const state = !SITE.scansTarget ? 'locked (laptop)'
      : anchor.locked ? 'locked' : `sampling ${anchor.samples.length}/${SAMPLE_COUNT}`
    const seen = anchor.lastSeen ? `${((performance.now() - anchor.lastSeen) / 1000).toFixed(1)} s ago` : 'never'
    this.hud.textContent = [
      `anchor        ${state}`,
      `target seen   ${seen}`,
      `scale         ${fmt(d && d.scale)}`,
      `scaledW × H   ${fmt(d && d.scaledWidth)} × ${fmt(d && d.scaledHeight)}`,
      `unitsPerMeter ${fmt(anchor.unitsPerMeter)}`,
    ].join('\n')
  },
}
