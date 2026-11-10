# Civic Lens Demo

Describe an object ("a wooden park bench", "an organic wooden pavilion"), then tap the ground to
place it in AR. Built on 8th Wall's open-source A-Frame engine.

## How it works

```
Phone (A-Frame + 8th Wall)              src/
  │  POST /api/resolve {prompt}           prompt-ui.js  text box → sets the current "brush"
  ▼                                       tap-place.js  places the brush at real-world height
                                          gumball.js    moves / rotates a tapped object
Python backend (holds API keys)         server/
  1. LLM router → {source, query,         llm_router.py Claude Haiku (optional, see below)
                   height_m}
  2a. library  → Poly Pizza → GLB URL     polypizza.py  generic objects, ~2 s
  2b. generate → Tripo job → poll         tripo.py      distinctive designs, ~1 min, costs
      GET /api/jobs/{id} → cached GLB                   credits; GLBs cached in server/generated
  ▼                                       keys.py       reads keys from the secrets folder
Phone loads the GLB, then each tap places a copy
```

Tap a placed object to select it and show a Rhino-style gumball: drag the red or green arrow to
move it along that ground axis, the white square to move it freely, or the blue ring to rotate
it. Tap the ground to deselect; the next ground tap places a new object.

The router sends common objects ("a bench", "street lamp") to the library and specific designs
("an organic wooden pavilion", "a bench shaped like a wave") to generation. Generated models are
saved in `server/generated/` (not committed) and served by the backend at `/api/models/`.

### API keys

Keys are read from files in a `secrets` folder that sits **next to** this repo, never from
environment variables and never committed:

```
City Science/
├── MAS552-Civic-Lens-Demo/   (this repo)
└── secrets/
    ├── PolyPizza API Key.txt   required
    ├── Anthropic API Key.txt   optional: enables the LLM router
    └── TripoAI API Key.txt     optional: enables text-to-3D generation (needs the router)
```

Each file holds either the bare key or one `NAME="value"` line. Without the Anthropic key, the
raw prompt is used as the search term, every model is placed 1 m tall, and nothing is generated. To mount the folder
elsewhere (e.g. in a container), point `CIVIC_LENS_SECRETS_DIR` at its path.

## Running locally

Run both commands from the repo folder, each in its own terminal, and keep both running.

1. Back end (first time: `python -m venv server/.venv` then
   `server/.venv/Scripts/python -m pip install -r server/requirements.txt`):

   ```bash
   npm run api
   ```

   Wait for `Uvicorn running on http://127.0.0.1:8000`.

2. Front end (first time: `npm install`):

   ```bash
   npm run serve
   ```

   The dev server proxies `/api` to the backend on port 8000 (set in `config/webpack.config.js`).
   "Could not reach the server" in the app means the back end is not running.

### Opening it on a phone

Phone browsers only allow camera access over HTTPS. A Cloudflare quick tunnel gives the local
dev server a public HTTPS link (no account needed):

1. Install `cloudflared` once: `winget install Cloudflare.cloudflared`
2. Start the back end with `npm run api`.
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

## Shared site frame (SoftMind logo)

Every phone that scans the SoftMind logo shares one coordinate frame, so content at a given
spot appears at the same physical spot on all phones. `src/site-anchor.js` averages the first
15 sightings of the logo, then locks the frame (`#siteRoot` → `#siteFrame`, in real-world
meters); **Resync** re-anchors it. The target lives in `image-targets/` (generated with
`npx @8thwall/image-target-cli@latest`) and is only registered on phones and tablets, so the
desktop keeps its 3D view.

- **Show the target:** open `image-targets/softmind_cropped.png` at a fixed size (same monitor,
  same zoom) and measure it with a ruler. Put the measured width and height, and the height of
  its center above the desk, in `src/config/site.js`.
- **Modes:** `screen` (logo on a monitor, objects as a 1:20 desk miniature) or `print` (printed
  logo, 1:1). Set `DEFAULT_MODE` in `src/config/site.js`, or add `?mode=print` to the URL. All
  phones must use the same mode.
- **Debug view:** add `?debug=1` for the 1 m grid and axes, three test markers (red, green,
  blue at fixed site positions), a yellow outline where the engine sees the logo, and a readout.

## Notes on 8th Wall

The camera's starting height (y = 8) sets the scale of virtual content: smaller y means bigger
content. `tap-place` assumes this height is roughly a phone held at ~1.6 m (`unitsPerMeter: 5`).
It can be reset at any time by calling [`recenter()`](https://www.8thwall.com/docs/web/#recenter).
The camera must not be at a height (y) of zero.

## Attribution

Models come from [Poly Pizza](https://poly.pizza). CC-BY models are credited on screen when
selected.
