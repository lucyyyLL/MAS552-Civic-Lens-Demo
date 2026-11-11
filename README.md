# Civic Lens Demo

Scan the SoftMind logo, describe an object ("a wooden park bench", "an organic wooden pavilion"),
then tap the ground to place it in AR at real-world size. Built on 8th Wall's open-source A-Frame engine.

## How it works

```
Phone (A-Frame + 8th Wall)              src/
  │  POST /api/resolve {prompt}           prompt-ui.js  text box → sets the current "brush"
  ▼                                       site-anchor.js shared frame locked to the logo
                                          tap-place.js  places the brush at real-world height
                                          gumball.js    moves / rotates a tapped object
                                          shared-objects.js  saves and syncs placed objects
                                          object-menu.js     publish / unpublish / delete
Python backend (holds API keys)         server/
  1. LLM router → {source, query,         llm_router.py Claude Haiku (optional, see below)
                   height_m}
  2a. library  → Poly Pizza → GLB URL     polypizza.py  generic objects, ~2 s
  2b. generate → Tripo job → poll         tripo.py      distinctive designs, ~1 min, costs
      GET /api/jobs/{id} → GLB URL                      credits
  ▼                                       supabase_project.py  stores generated GLBs
Phone loads the GLB, then each tap        keys.py       reads keys from the secrets folder
places a copy, saved to Supabase
```

Tap one of your objects to select it and show a Rhino-style gumball: drag the red or green arrow
to move it along that ground axis, the white square to move it freely, or the blue ring to
rotate it. Tap the ground to deselect; the next ground tap places a new object.

The router sends common objects ("a bench", "street lamp") to the library and specific designs
("an organic wooden pavilion", "a bench shaped like a wave") to generation. Generated models are
copied to the Supabase Storage bucket `models`, because Tripo's download links expire.

### Shared objects and layers

Every placed object is a row in the Supabase table `objects` (positions in meters in the shared
site frame), and every phone at the site sees changes live.

- New objects are **private**: only you see them, slightly see-through.
- **Long-press** (or **right-click** on desktop) one of your objects for its menu: **Publish**
  makes it **common**, so everyone sees it and watches your gumball edits live; **Unpublish**
  makes it private again; **Delete** removes it for everyone.
- Other people's common objects can't be moved; tapping one shows its prompt and who placed it.
- **Mine / Common / Both** (bottom left) chooses which objects to show.

Each browser signs in anonymously and keeps its user id, so clearing the site's data makes its
earlier objects someone else's. Row-level security in the database lets only owners change or
delete objects.

#### Supabase setup (once)

1. In the Supabase dashboard, run `supabase/schema.sql` in the SQL Editor. It creates the table,
   its security rules, live updates, and the public `models` bucket.
2. Enable Authentication → Sign In / Providers → **Allow anonymous sign-ins**.
3. Put the project settings in `secrets/Supabase Settings.txt` (see below).

The front end gets the project URL and the publishable key from the backend
(`GET /api/supabase-config`), so neither is committed. The publishable key is safe in browsers
because row-level security protects the data; the secret key is used only by the backend.

### API keys

Keys are read from files in a `secrets` folder that sits **next to** this repo, never from
environment variables and never committed:

```
City Science/
├── MAS552-Civic-Lens-Demo/   (this repo)
└── secrets/
    ├── PolyPizza API Key.txt   required
    ├── Anthropic API Key.txt   optional: enables the LLM router
    ├── TripoAI API Key.txt     optional: enables text-to-3D generation (needs the router)
    └── Supabase Settings.txt   required: PROJECT_ID (project URL or ref), PUBLISHABLE_KEY,
                                SECRET_KEY, one NAME="value" per line
```

Each key file holds either the bare key or one `NAME="value"` line. Without the Anthropic key, the
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
meters); **Resync** re-anchors it. The ground and every placed object live inside `#siteFrame`,
so positions are meters from the logo and objects follow the frame when it resyncs. The prompt
and placement stay disabled until the first lock. On the laptop, which never scans the logo, the
frame locks at once to the desktop scene, so it can still be used for development; its positions
do not line up with any real logo. The target lives in `image-targets/` (generated with
`npx @8thwall/image-target-cli@latest`) and is only registered on phones and tablets, so the
desktop keeps its 3D view.

- **Show the target:** print `image-targets/softmind_cropped.png`, or open it on a monitor at a
  fixed size (same monitor, same zoom). Measure it with a ruler, and measure the height of its
  center above the floor. Put all three in `src/config/site.js`; every phone must use the same
  values.
- **Debug view:** add `?debug=1` for the 1 m grid and axes, three test markers (red, green,
  blue at fixed site positions), a yellow outline where the engine sees the logo, and a readout.

## Notes on 8th Wall

The camera's starting height (y = 8) sets the scale of 8th Wall's world units. On phones the
logo's measured size converts those units to meters; on the laptop `site-anchor` assumes the
start height is a phone held at ~1.6 m (5 units per meter). The camera must not be at a height
(y) of zero.

## Attribution

Models come from [Poly Pizza](https://poly.pizza). CC-BY models are credited on screen when
selected.
