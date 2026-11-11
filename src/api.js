// Calls to the Python backend (server/app.py).

// Backend origin. Empty means same origin: in development the webpack dev server proxies
// /api to the Python server. Set this to the deployed backend URL for a production build.
export const API_BASE = ''

// Calls the backend and returns its JSON body, throwing the server's error message on failure
export const api = async (path, options) => {
  const res = await fetch(`${API_BASE}${path}`, options)
  // A non-JSON body means the backend is down or unreachable
  const body = await res.json().catch(() => ({detail: 'Could not reach the server'}))
  if (!res.ok) throw new Error(body.detail)
  return body
}
