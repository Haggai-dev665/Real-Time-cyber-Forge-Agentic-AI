/**
 * Threat Globe Screen Adapter
 * Routes to the shared Threat Map + OTX pipeline used by cyberforge-app.
 */

class ThreatGlobeScreen {
  async show(container) {
    if (!container) return;

    const layouts = window.ChildPageLayouts || {};
    const loaders = window.CyberForgeDataLoaders || {};

    if (typeof layouts.buildThreatMapLayout === 'function') {
      container.innerHTML = layouts.buildThreatMapLayout();
    } else {
      container.innerHTML = '<div class="screen-error"><p>Threat Globe layout unavailable</p></div>';
      return;
    }

    if (typeof loaders.initThreatMap === 'function') {
      loaders.initThreatMap();
    }
  }

  hide() {
    // Map cleanup is handled by shared dashboard globe logic.
  }
}

// Low-resolution continent polygons [lon, lat] for the shared dashboard 2D renderer.
ThreatGlobeScreen.WORLD_POLYGONS = [
  [
    [-168, 12], [-165, 52], [-142, 68], [-120, 72], [-100, 68], [-82, 50],
    [-77, 30], [-97, 15], [-125, 10], [-150, 8]
  ],
  [
    [-82, 13], [-76, -4], [-70, -18], [-64, -30], [-58, -42], [-50, -52],
    [-42, -48], [-35, -26], [-44, -10], [-54, 2], [-66, 10]
  ],
  [
    [-10, 36], [0, 46], [18, 56], [42, 60], [66, 58], [90, 52],
    [116, 48], [138, 42], [150, 56], [168, 56], [178, 46], [168, 32],
    [138, 22], [110, 10], [84, 20], [60, 30], [42, 38], [28, 34], [14, 30]
  ],
  [
    [-18, 36], [2, 36], [16, 28], [28, 12], [34, -6], [30, -22],
    [20, -34], [8, -34], [-6, -22], [-12, -2], [-16, 20]
  ],
  [
    [112, -10], [124, -16], [138, -24], [150, -34], [154, -42], [146, -44],
    [132, -40], [118, -30], [110, -18]
  ],
  [
    [-52, 60], [-40, 72], [-22, 80], [-12, 74], [-20, 64], [-36, 58]
  ]
];

if (typeof window !== 'undefined') {
  window.ThreatGlobeScreen = ThreatGlobeScreen;
}
