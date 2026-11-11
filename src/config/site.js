// Shared-site settings. Every phone must use the same values, or they will disagree.
// Content is shown at real-world scale: 1 unit inside #siteFrame is 1 meter.

const {isMobile, isTablet} = AFRAME.utils.device
const params = new URLSearchParams(window.location.search)

export const SITE = {
  siteId: 'softmind-demo',
  targetName: 'softmind',
  // Physical size of the target image (image-targets/softmind_cropped.png, 4:3 landscape) as
  // shown, measured with a ruler: the print, or the image on your monitor at a fixed zoom.
  // Currently the image on the monitor, 4 in x 3 in.
  targetWidthM: 0.1016,
  targetHeightM: 0.0762,
  // Height of the target's center above the floor objects stand on. Measure on site.
  targetCenterHeightM: 0.95,
  // Only phones and tablets scan the target; the laptop keeps 8th Wall's desktop 3D view
  scansTarget: isMobile() || isTablet(),
  debug: params.get('debug') === '1',
}
