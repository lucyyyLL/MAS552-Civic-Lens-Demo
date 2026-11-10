// Copyright (c) 2022 8th Wall, Inc.
//
// app.js is the main entry point for your 8th Wall app. Code here will execute after head.html
// is loaded, and before body.html is loaded.

import './index.css'

// Register custom A-Frame components in app.js before the scene in body.html has loaded.
import {tapPlaceComponent} from './tap-place'
import {promptUiComponent} from './prompt-ui'
import {gumballComponent} from './gumball'
import {siteAnchorComponent} from './site-anchor'
import {siteDebugComponent} from './site-debug'
import softmindTarget from '../image-targets/softmind.json'

AFRAME.registerComponent('tap-place', tapPlaceComponent)
AFRAME.registerComponent('prompt-ui', promptUiComponent)
AFRAME.registerComponent('gumball', gumballComponent)
AFRAME.registerComponent('site-anchor', siteAnchorComponent)
AFRAME.registerComponent('site-debug', siteDebugComponent)

// Register the SoftMind logo as an image target once the engine has loaded. World tracking stays
// on alongside it. Phones and tablets only: with an image target registered, 8th Wall replaces
// the desktop 3D view with a "continue on your phone" page.
const {isMobile, isTablet} = AFRAME.utils.device
if (isMobile() || isTablet()) {
  const onxrloaded = () => {
    XR8.XrController.configure({imageTargetData: [softmindTarget]})
  }
  window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)
}
