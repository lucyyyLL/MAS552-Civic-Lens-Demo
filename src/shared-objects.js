// Placed objects, shared between phones through Supabase (table public.objects, created by
// supabase/schema.sql). Each object is one row with its transform in site meters and one entity
// under #siteFrame. upsert() and remove() are the only code paths that create, change or delete
// those entities; placing, dragging and the object menu write rows and then call them.
//
// Layers: a new object is private (only its owner sees it). Publishing sets layer = 'common', so
// everyone at the site sees it, and the owner's later edits go live. Only the owner can move,
// publish or delete an object; row-level security enforces this as well.

import {createClient} from '@supabase/supabase-js'

import {api} from './api'
import {SITE} from './config/site'

const SAVE_INTERVAL_MS = 150  // while dragging, other phones see the move at most this often
const PRIVATE_OPACITY = 0.55  // private objects are see-through, so it's clear they aren't shared

// Which objects each view shows
const VIEWS = {
  mine: (row, mine) => mine && row.layer === 'private',
  common: row => row.layer === 'common',
  both: () => true,
}

export const sharedObjectsComponent = {
  init() {
    this.frame = document.getElementById('siteFrame')
    this.status = document.getElementById('status')
    this.objects = new Map()        // row id → {row, el, loaded}
    this.view = 'both'
    this.lastSave = 0
    this.saves = Promise.resolve()  // updates run one at a time, so the last position wins

    this.ready = this.connect()
    this.el.addEventListener('site-locked', () => {
      this.ready.then(() => this.load()).catch((err) => {
        this.status.textContent = `Shared space unavailable: ${err.message}`
      })
    }, {once: true})

    this.viewToggle = document.getElementById('viewToggle')
    this.viewToggle.addEventListener('click', ({target}) => {
      if (target.dataset.view) this.setView(target.dataset.view)
    })
  },

  // Connects with the settings from the backend and signs in anonymously. The session is kept
  // in the browser, so a phone keeps its user id (and its objects) across visits.
  async connect() {
    const {url, publishableKey} = await api('/api/supabase-config')
    this.db = createClient(url, publishableKey)
    const {data: {session}} = await this.db.auth.getSession()
    if (session) {
      this.userId = session.user.id
      return
    }
    const {data, error} = await this.db.auth.signInAnonymously()
    if (error) throw error
    this.userId = data.user.id
  },

  // Loads this site's objects (row-level security returns common ones plus this user's private
  // ones) and follows changes from other phones
  async load() {
    // Subscribe first, so a change between the query and the subscription isn't missed
    this.channel = this.db.channel(`objects-${SITE.siteId}`)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'objects'},
        ({eventType, new: row, old}) => {
          // Deletes can't be filtered by site, but removing an unknown id does nothing
          if (eventType === 'DELETE') this.remove(old.id)
          else if (row.site_id === SITE.siteId) this.upsert(row)
        })
      // Row-level security hides an unpublished object's update from everyone but its owner,
      // so the owner announces it instead (see setLayer)
      .on('broadcast', {event: 'unpublished'}, ({payload}) => this.remove(payload.id))
      .subscribe()

    const {data, error} = await this.db.from('objects').select().eq('site_id', SITE.siteId)
    if (error) throw error
    data.forEach(row => this.upsert(row))
    this.viewToggle.hidden = false
  },

  isMine(row) {
    return row.owner_id === this.userId
  },

  // Saves a new private object at a position in site meters, then shows it
  async create(position, {modelUrl, upright, height, prompt, attribution}) {
    await this.ready
    const {data, error} = await this.db.from('objects').insert({
      site_id: SITE.siteId,
      layer: 'private',
      prompt,
      model_url: modelUrl,
      attribution,
      upright: [upright.x, upright.y, upright.z],
      height_m: height,
      pos_x: position.x,
      pos_y: position.y,
      pos_z: position.z,
    }).select().single()
    if (error) throw error
    this.upsert(data)
  },

  // Saves a dragged object's position and rotation: during the drag at most every
  // SAVE_INTERVAL_MS, and always once when it ends
  save(el, final) {
    const now = performance.now()
    if (!final && now - this.lastSave < SAVE_INTERVAL_MS) return
    this.lastSave = now
    const {position, rotation} = el.object3D
    this.write(el.dataset.objectId, {
      pos_x: position.x,
      pos_y: position.y,
      pos_z: position.z,
      rotation_y: THREE.MathUtils.radToDeg(rotation.y),
    })
  },

  write(id, fields) {
    this.saves = this.saves.then(async () => {
      const {error} = await this.db.from('objects').update(fields).eq('id', id)
      if (error) this.status.textContent = `Could not save: ${error.message}`
    })
    return this.saves
  },

  // Publishes ('common') or unpublishes ('private') one of this user's objects
  async setLayer(entry, layer) {
    await this.write(entry.row.id, {layer})
    if (layer === 'private') {
      this.channel.send({type: 'broadcast', event: 'unpublished', payload: {id: entry.row.id}})
    }
    entry.row = {...entry.row, layer}
    this.show(entry)
  },

  // Deletes one of this user's objects, for everyone
  async destroy(entry) {
    const {error} = await this.db.from('objects').delete().eq('id', entry.row.id)
    if (error) {
      this.status.textContent = `Could not delete: ${error.message}`
      return
    }
    this.remove(entry.row.id)
  },

  // Creates or updates the entity for a row
  upsert(row) {
    const known = this.objects.get(row.id)
    if (known) {
      known.row = row
      // Leave an object this phone is dragging under the finger, not where an older save put it
      const {gumball} = this.el.components
      if (!(gumball.drag && gumball.target === known.el)) setTransform(known.el, row)
      this.show(known)
      return
    }

    const el = document.createElement('a-entity')
    const entry = {row, el, loaded: false}
    this.objects.set(row.id, entry)
    el.dataset.objectId = row.id
    el.object3D.visible = false  // until the model is loaded and measured
    setTransform(el, row)
    el.setAttribute('shadow', {receive: false})
    el.setAttribute('gltf-model', row.model_url)

    el.addEventListener('model-loaded', () => {
      const scale = normalize(el, row.upright, row.height_m)
      ownMaterials(el)
      entry.loaded = true
      this.show(entry)

      // Pop the model in with an elastic scale animation
      el.setAttribute('scale', '0.0001 0.0001 0.0001')
      el.setAttribute('animation', {
        property: 'scale',
        to: `${scale} ${scale} ${scale}`,
        easing: 'easeOutElastic',
        dur: 800,
      })

      // Tapping your own object selects it for the gumball; anyone else's shows its info
      el.addEventListener('click', () => {
        if (this.isMine(entry.row)) this.el.components.gumball.select(el)
        else this.el.components['object-menu'].open(entry)
      })
    })
    el.addEventListener('model-error', () => {
      this.status.textContent = `Could not load the model for "${row.prompt}"`
    })

    this.frame.appendChild(el)
  },

  remove(id) {
    const entry = this.objects.get(id)
    if (!entry) return
    const {gumball} = this.el.components
    if (gumball.target === entry.el) gumball.select(null)
    this.el.emit('object-removed', {entry})
    entry.el.remove()
    this.objects.delete(id)
  },

  // Applies the current view and the private look to a loaded object
  show({row, el, loaded}) {
    if (!loaded) return
    const visible = VIEWS[this.view](row, this.isMine(row))
    el.object3D.visible = visible
    // The camera's raycaster only targets .cantap, so hidden objects can't be tapped
    el.classList.toggle('cantap', visible)
    setOpacity(el, row.layer === 'private' ? PRIVATE_OPACITY : 1)

    const {gumball} = this.el.components
    if (gumball.target === el && !visible) gumball.select(null)
  },

  setView(view) {
    this.view = view
    for (const button of this.viewToggle.children) {
      button.setAttribute('aria-pressed', button.dataset.view === view)
    }
    this.objects.forEach(entry => this.show(entry))
  },
}

const setTransform = (el, row) => {
  el.object3D.position.set(row.pos_x, row.pos_y, row.pos_z)
  el.object3D.rotation.y = THREE.MathUtils.degToRad(row.rotation_y)
}

// Models from different sources use arbitrary units, origins and up axes. This stands the mesh
// upright, centers it on its entity, rests its base on the entity's origin, and returns the
// uniform scale that makes it `height` meters tall. The bounding box is measured in the entity's
// own space, so the entity's current position and rotation don't matter.
const normalize = (el, [x, y, z], height) => {
  const mesh = el.getObject3D('mesh')
  const toRad = THREE.MathUtils.degToRad
  mesh.rotation.set(toRad(x), toRad(y), toRad(z))

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

// gltf-model shares materials between copies of the same model. Give each object its own,
// remembering the original look, so one object can turn see-through on its own.
const ownMaterials = (el) => {
  el.getObject3D('mesh').traverse((node) => {
    if (!node.material) return
    node.material = node.material.clone()
    node.material.userData.base = {opacity: node.material.opacity, transparent: node.material.transparent}
  })
}

const setOpacity = (el, factor) => {
  el.getObject3D('mesh').traverse(({material}) => {
    if (!material) return
    const {base} = material.userData
    const transparent = base.transparent || factor < 1
    material.opacity = base.opacity * factor
    if (material.transparent !== transparent) {
      material.transparent = transparent
      material.needsUpdate = true
    }
  })
}
