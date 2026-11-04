// Text prompt overlay: sends the user's description to the backend and makes the returned
// model the current tap-place "brush".

// Backend origin. Empty means same origin: in development the webpack dev server proxies
// /api to the Python server. Set this to the deployed backend URL for a production build.
const API_BASE = ''

export const promptUiComponent = {
  init() {
    const form = document.getElementById('promptForm')
    this.input = document.getElementById('promptInput')
    this.button = form.querySelector('button')
    this.status = document.getElementById('status')
    this.credit = document.getElementById('credit')

    // 8th Wall's desktop controls listen for WASD/arrow keys on window. Keep typing in the
    // text box from moving the camera.
    for (const type of ['keydown', 'keyup']) {
      this.input.addEventListener(type, event => event.stopPropagation())
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.resolve(this.input.value.trim())
    })
  },

  async resolve(prompt) {
    if (!prompt) return
    this.button.disabled = true
    this.status.textContent = `Finding "${prompt}"…`

    try {
      const res = await fetch(`${API_BASE}/api/resolve`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt}),
      })
      // A non-JSON body means the backend is down or unreachable
      const body = await res.json().catch(() => ({detail: 'Could not reach the server'}))
      if (!res.ok) throw new Error(body.detail)

      const [x, y, z] = body.uprightRotation
      this.el.setAttribute('tap-place', {
        modelUrl: body.modelUrl,
        upright: {x, y, z},
        height: body.heightM,
      })
      this.status.textContent = `${body.title} ready. Tap the ground to place it.`
      // CC-BY models require visible credit
      this.credit.textContent = body.attribution
    } catch (err) {
      this.status.textContent = err.message
    } finally {
      this.button.disabled = false
    }
  },
}
