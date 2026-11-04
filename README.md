# Civic Lens Demo

Describe an object ("a wooden park bench", "a small oak tree"), then tap the ground to place it in
AR. Built on 8th Wall's open-source A-Frame engine.

## How it works

```
Phone (A-Frame + 8th Wall)         src/
  │  POST /api/resolve {prompt}      prompt-ui.js  text box → sets the current "brush"
  ▼                                  tap-place.js  places the brush, normalized to real-world height
Python backend (holds API keys)    server/
  1. LLM router → {query, height_m}  llm_router.py Claude Haiku (optional, see below)
  2. Poly Pizza search → GLB URL     polypizza.py
  ▼                                  keys.py       reads keys from the secrets folder
Phone loads the GLB, then each tap places a copy
```

### API keys

Keys are read from files in a `secrets` folder that sits **next to** this repo, never from
environment variables and never committed:

```
City Science/
├── MAS552-Civic-Lens-Demo/   (this repo)
└── secrets/
    ├── PolyPizza API Key.txt   required
    └── Anthropic API Key.txt   optional: enables the LLM router
```

Each file holds either the bare key or one `NAME="value"` line. Without the Anthropic key, the
raw prompt is used as the search term and every model is placed 1 m tall. To mount the folder
elsewhere (e.g. in a container), point `CIVIC_LENS_SECRETS_DIR` at its path.

## Running locally

1. Back end (first time: `python -m venv server/.venv` then
   `server/.venv/Scripts/python -m pip install -r server/requirements.txt`):

   ```bash
   cd server && .venv/Scripts/python -m uvicorn app:app --port 8000 --reload
   ```

2. Front end, in a second terminal (first time: `npm install`):

   ```bash
   npm run serve
   ```

   The dev server proxies `/api` to the backend on port 8000.

### Opening it on a phone

Phone browsers only allow camera access over HTTPS. A Cloudflare quick tunnel gives the local
dev server a public HTTPS link (no account needed):

1. Install `cloudflared` once: `winget install Cloudflare.cloudflared`
2. Start the backend as above.
3. Start the front end so it accepts requests from the tunnel's domain:

   ```bash
   npm run serve -- --allowed-hosts all
   ```

4. In a third terminal, open the tunnel:

   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```

5. Open the printed `https://<random>.trycloudflare.com` link on the phone.

The laptop must keep all three processes running, and the link changes every time the tunnel
restarts. Anyone with the link can use the backend (and spend your API credits), so share it
only with people you trust and stop the tunnel when you are done.

## Deployment

Pushing `main` deploys the front end to GitHub Pages (see `.github/workflows/deploy.yml`). Pages
only serves static files, so the backend must be hosted separately; set `API_BASE` in
`src/prompt-ui.js` to its URL.

## Notes on 8th Wall

The camera's starting height (y = 8) sets the scale of virtual content: smaller y means bigger
content. `tap-place` assumes this height is roughly a phone held at ~1.6 m (`unitsPerMeter: 5`).
It can be reset at any time by calling [`recenter()`](https://www.8thwall.com/docs/web/#recenter).
The camera must not be at a height (y) of zero.

## Attribution

Models come from [Poly Pizza](https://poly.pizza). CC-BY models are credited on screen when
selected.
