// Menu for a placed object, opened by a long press (phones) or a right-click (desktop), and by
// tapping someone else's object. Owners can publish, unpublish or delete their objects; anyone
// else's shared object only shows who placed it and its prompt.

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10  // a press that moves further is a drag, not a long press

export const objectMenuComponent = {
  init() {
    this.menu = document.getElementById('objectMenu')
    this.info = this.menu.querySelector('p')
    this.actions = this.menu.querySelector('div')
    this.entry = null    // the object the menu is open for
    this.pointer = null  // where the current press started
    this.timer = null

    window.addEventListener('pointerdown', ({clientX, clientY}) => {
      this.pointer = {x: clientX, y: clientY}
    }, true)
    window.addEventListener('pointermove', ({clientX, clientY}) => {
      if (this.timer && Math.hypot(clientX - this.pointer.x, clientY - this.pointer.y) > MOVE_TOLERANCE_PX) {
        this.cancelPress()
      }
    }, true)
    window.addEventListener('pointerup', () => this.cancelPress(), true)

    // The cursor emits mousedown on the entity under a press; it bubbles up to the scene. A press
    // on a gumball handle never gets here, because the gumball claims it first.
    this.el.addEventListener('mousedown', ({target}) => {
      const entry = this.objectFor(target)
      if (entry) this.timer = setTimeout(() => this.open(entry), LONG_PRESS_MS)
    })

    // Right-click on desktop (and the browser's own long-press menu on Android): show ours
    window.addEventListener('contextmenu', (event) => {
      if (event.target !== this.el.canvas) return
      event.preventDefault()
      const entry = this.objectFor(document.getElementById('camera').components.cursor.intersectedEl)
      if (entry) this.open(entry)
    })

    this.el.addEventListener('object-removed', ({detail}) => {
      if (detail.entry === this.entry) this.close()
    })
  },

  objectFor(el) {
    const id = el && el.dataset.objectId
    return id && this.el.components['shared-objects'].objects.get(id)
  },

  cancelPress() {
    clearTimeout(this.timer)
    this.timer = null
  },

  open(entry) {
    this.cancelPress()
    this.entry = entry
    const objects = this.el.components['shared-objects']
    const {row} = entry
    const mine = objects.isMine(row)

    const owner = mine ? 'Yours' : `Placed by guest ${row.owner_id.slice(0, 4)}`
    const layer = row.layer === 'common' ? 'shared with everyone' : 'private, only you see it'
    this.info.textContent = `"${row.prompt}" · ${owner}${mine ? ` · ${layer}` : ''}`

    const buttons = []
    if (mine) {
      buttons.push(row.layer === 'private'
        ? ['Publish', () => objects.setLayer(entry, 'common')]
        : ['Unpublish', () => objects.setLayer(entry, 'private')])
      const question = row.layer === 'common' ? `Delete "${row.prompt}" for everyone?` : `Delete "${row.prompt}"?`
      buttons.push(['Delete', () => { if (window.confirm(question)) objects.destroy(entry) }])
    }
    buttons.push(['Close', () => {}])

    this.actions.replaceChildren(...buttons.map(([label, action]) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.addEventListener('click', () => {
        this.close()
        action()
      })
      return button
    }))
    this.menu.hidden = false
  },

  close() {
    this.menu.hidden = true
    this.entry = null
  },
}
