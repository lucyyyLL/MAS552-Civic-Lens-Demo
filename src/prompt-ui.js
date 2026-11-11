// Text prompt overlay: sends the user's description to the backend and makes the returned
// model the current tap-place "brush".

import {api} from './api'

const POLL_INTERVAL_MS = 2000
const JOB_TIMEOUT_MS = 5 * 60 * 1000  // generation usually takes one to two minutes

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

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

    // The form starts hidden behind "Point your camera at the SoftMind logo" (index.html)
    this.el.addEventListener('site-locked', () => {
      if (!form.hidden) return  // a resync, not the first lock
      form.hidden = false
      this.status.textContent = 'Describe an object, then tap the ground to place it'
    })
  },

  async resolve(prompt) {
    if (!prompt) return
    this.button.disabled = true
    this.status.textContent = `Finding "${prompt}"…`

    try {
      const body = await api('/api/resolve', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt}),
      })
      // Library models come with a URL; generated ones with a job to wait for
      const modelUrl = body.modelUrl ?? await this.waitForJob(body.jobId, body.title)

      const [x, y, z] = body.uprightRotation
      this.el.setAttribute('tap-place', {
        modelUrl,
        upright: {x, y, z},
        height: body.heightM,
        prompt,
        attribution: body.attribution,
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

  // Polls a text-to-3D job and returns the finished model's URL
  async waitForJob(jobId, title) {
    const deadline = Date.now() + JOB_TIMEOUT_MS
    while (Date.now() < deadline) {
      const job = await api(`/api/jobs/${jobId}`)
      if (job.status === 'success') return job.modelUrl
      if (job.status === 'failed') throw new Error(job.error)

      this.status.textContent = `Generating "${title}"… ${job.progress}%`
      await sleep(POLL_INTERVAL_MS)
    }
    throw new Error('Generation timed out. Please try again.')
  },
}
