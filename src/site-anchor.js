// Anchors the shared site frame to the SoftMind image target, so every phone that scans the logo
// shares one coordinate system:
//
//   SLAM world (each phone's own)
//    └─ #siteRoot   position + yaw only, origin on the ground below the target's center
//        └─ #siteFrame  uniform scale = SLAM units per real meter × worldScale
//
// The first SAMPLE_COUNT sightings are averaged, then the frame is locked and later sightings are
// ignored, so content stays steady and only world tracking moves the view. Losing sight of the
// target changes nothing: world tracking keeps the frame in place.

import {SITE} from './config/site'

export const SAMPLE_COUNT = 15
const AUTO_RESYNC_AFTER_MS = 10000  // re-anchor when the target is found again after this long
const BLEND_MS = 300                // re-anchoring glides instead of jumping

// Turns one target sighting into a site pose sample
const sample = (detail, cameraPosition) => {
  const position = new THREE.Vector3().copy(detail.position)
  const rotation = new THREE.Quaternion().copy(detail.rotation)

  // The image lies in its local XY plane with +Z out of its face (check with ?debug=1 axes)
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation)
  let forward
  if (Math.abs(normal.y) < 0.7) {
    // Upright target (screen, wall poster): forward is the face normal, level, toward the viewer
    forward = normal.setY(0)
    if (forward.dot(cameraPosition.clone().sub(position)) < 0) forward.negate()
  } else {
    // Flat target (table, floor): forward is the image's in-plane up, level
    forward = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).setY(0)
  }

  // The image's long edge in SLAM units, over its measured long edge in meters. Target and
  // measurement are both 4:3, so this holds whichever edge the engine calls "height".
  const unitsPerMeter = (Math.max(detail.scaledWidth, detail.scaledHeight) * detail.scale) /
    Math.max(SITE.targetWidthM, SITE.targetHeightM)

  return {position, yaw: Math.atan2(forward.x, forward.z), unitsPerMeter}
}

// Averages samples; yaw is averaged through sin/cos so angles near ±180° don't cancel out
const average = (samples) => {
  const position = new THREE.Vector3()
  let sin = 0
  let cos = 0
  let unitsPerMeter = 0
  for (const s of samples) {
    position.add(s.position)
    sin += Math.sin(s.yaw)
    cos += Math.cos(s.yaw)
    unitsPerMeter += s.unitsPerMeter
  }
  return {
    position: position.divideScalar(samples.length),
    yaw: Math.atan2(sin, cos),
    unitsPerMeter: unitsPerMeter / samples.length,
  }
}

export const siteAnchorComponent = {
  init() {
    this.root = document.getElementById('siteRoot').object3D
    this.frame = document.getElementById('siteFrame').object3D
    this.locked = false
    this.samples = []
    this.unitsPerMeter = null  // of the current lock
    this.lastSeen = 0          // when the target was last tracked (ms)
    this.blend = null          // in-progress glide to a new lock
    this.cameraPosition = new THREE.Vector3()

    this.el.addEventListener('xrimagefound', (event) => {
      const outOfViewMs = performance.now() - this.lastSeen
      if (event.detail.name === SITE.targetName && this.locked && outOfViewMs > AUTO_RESYNC_AFTER_MS) {
        this.resync()
      }
      this.onSighting(event)
    })
    this.el.addEventListener('xrimageupdated', event => this.onSighting(event))

    this.resyncButton = document.getElementById('resyncButton')
    this.resyncButton.addEventListener('click', () => this.resync())
  },

  onSighting({detail}) {
    if (detail.name !== SITE.targetName) return
    this.lastSeen = performance.now()
    if (this.locked) return

    this.el.camera.getWorldPosition(this.cameraPosition)
    this.samples.push(sample(detail, this.cameraPosition))
    if (this.samples.length >= SAMPLE_COUNT) this.lock(average(this.samples))
  },

  lock({position, yaw, unitsPerMeter}) {
    const pose = {
      // Ground height comes from config, not SLAM, so every phone agrees on it
      position: position.sub(new THREE.Vector3(0, SITE.targetCenterHeightM * unitsPerMeter, 0)),
      yaw,
      scale: unitsPerMeter * SITE.worldScale,
    }

    if (this.unitsPerMeter === null) {
      this.apply(pose)  // first lock: snap
      this.root.visible = true
      this.resyncButton.hidden = false
    } else {
      this.blend = {
        from: {position: this.root.position.clone(), yaw: this.root.rotation.y, scale: this.frame.scale.x},
        to: pose,
        start: performance.now(),
      }
    }

    this.locked = true
    this.samples = []
    this.unitsPerMeter = unitsPerMeter
    this.el.emit('site-locked', {unitsPerMeter})
  },

  // Re-averages the next sightings and re-locks (the target must be in view)
  resync() {
    this.locked = false
    this.samples = []
  },

  apply({position, yaw, scale}) {
    this.root.position.copy(position)
    this.root.rotation.set(0, yaw, 0)  // yaw only: content stays level even if the target is tilted
    this.frame.scale.setScalar(scale)
  },

  tick() {
    if (!this.blend) return
    const {from, to, start} = this.blend
    const t = Math.min((performance.now() - start) / BLEND_MS, 1)
    // Turn the shorter way round
    const turn = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw))
    this.apply({
      position: from.position.clone().lerp(to.position, t),
      yaw: from.yaw + turn * t,
      scale: from.scale + (to.scale - from.scale) * t,
    })
    if (t === 1) this.blend = null
  },
}
