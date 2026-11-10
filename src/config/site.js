// Shared-site settings. Every phone must run the same mode, or they will disagree.
// Switch MODE when moving from screen testing to the printed target, or override it without
// redeploying with ?mode=print / ?mode=screen in the page URL.
const DEFAULT_MODE = 'screen'  // 'screen' | 'print'

const PRESETS = {
  screen: {
    // Physical size of the target image (image-targets/softmind_cropped.png, 4:3 landscape) as
    // displayed on YOUR screen, measured with a ruler. Re-measure if the monitor or zoom changes.
    // Currently 4 in x 3 in.
    targetWidthM: 0.1016,
    targetHeightM: 0.0762,
    // Height of the target's center above the surface objects stand on (the desk)
    targetCenterHeightM: 0.20,
    // Miniature: 1 real meter is shown as 5 cm, so a 4 m pavilion is 20 cm tall on the desk
    worldScale: 0.05,
  },
  print: {
    // Measure the actual print. Placeholder: A2 width with the image's 4:3 height.
    targetWidthM: 0.594,
    targetHeightM: 0.4455,
    targetCenterHeightM: 1.40,  // measure on site: poster center to the ground
    worldScale: 1.0,            // 1:1 real world
  },
}

const params = new URLSearchParams(window.location.search)
const mode = PRESETS[params.get('mode')] ? params.get('mode') : DEFAULT_MODE

export const SITE = {
  siteId: 'softmind-demo',
  targetName: 'softmind',
  mode,
  debug: params.get('debug') === '1',
  ...PRESETS[mode],
}
