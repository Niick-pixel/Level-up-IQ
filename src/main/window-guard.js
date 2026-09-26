// Keeps Mind Gym from looking "fullscreen" to Focus Point.
//
// Focus Point holds its breaks while the foreground window covers the whole monitor. A normal
// maximized window stops at the taskbar, so it's fine. But with an auto-hidden taskbar (or on a
// monitor without one) a maximized window covers everything and Focus Point would wait. In that
// case we "maximize" to the work area minus one pixel instead: it looks the same, and breaks
// still happen. Mind Gym is screen time, not rest.

/** Pure check, exported for tests: would a maximized window on this display cover the monitor? */
function coversMonitor(display) {
  const { bounds: b, workArea: w } = display;
  return w.x <= b.x && w.y <= b.y && w.x + w.width >= b.x + b.width && w.y + w.height >= b.y + b.height;
}

/** Bounds to use instead of a real maximize. */
function safeBounds(display) {
  const w = display.workArea;
  return { x: w.x, y: w.y, width: w.width, height: w.height - 1 };
}

/**
 * @param {Electron.BrowserWindow} win
 * @param {{ screen: Electron.Screen, getSettings: () => object }} deps
 */
function guardWindow(win, { screen, getSettings }) {
  let restoreBounds = null; // bounds before our pseudo-maximize, so the button can undo it

  win.on('maximize', () => {
    if (!getSettings().safeMaximize) return;
    const display = screen.getDisplayMatching(win.getBounds());
    if (!coversMonitor(display)) return;
    win.unmaximize();
    restoreBounds = win.getBounds();
    win.setBounds(safeBounds(display));
  });

  return {
    /** Toggle used by the title-bar double-click / our own maximize button. */
    toggleMaximize() {
      if (restoreBounds) {
        win.setBounds(restoreBounds);
        restoreBounds = null;
      } else if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    },
    isPseudoMaximized: () => restoreBounds !== null,
    /** Fullscreen only when the user opted in (it can delay Focus Point breaks). */
    setFullscreen(on) {
      if (on && !getSettings().allowFullscreen) return false;
      win.setFullScreen(Boolean(on));
      return win.isFullScreen();
    },
  };
}

module.exports = { guardWindow, coversMonitor, safeBounds };
