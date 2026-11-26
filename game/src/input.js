// Skyline Courier — keyboard and mouse input.
//
// Polled once per frame. Held keys give continuous control (steer, throttle,
// pitch); single presses are edge-triggered and consumed once, so a pause or
// restart key never fires twice from one tap.
//
// Controls:
//   Left / Right or A / D .... bank and turn
//   Up / W ................... throttle up (and a gentle climb)
//   Down / S ................. throttle down (and a gentle descent)
//   Mouse .................... move to steer and pitch, hold click for throttle
//   P or Escape .............. pause      M ... mute      R ... restart

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered presses, consumed by consume()
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.mouseSeen = false;
    this.mouseDown = false;
    this.lastMouseMove = -1e9;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (event.clientX - rect.left) / rect.width;
      this.mouseY = (event.clientY - rect.top) / rect.height;
      this.mouseSeen = true;
      this.lastMouseMove = performance.now();
    });
    canvas.addEventListener('mousedown', () => {
      this.mouseDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  // True once for a key pressed since the last frame; the press is consumed.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Continuous flight control for this frame: steer -1..1, throttleDelta
  // -1/0/+1, climb -1..1 (mouse pitch; positive climbs).
  poll(now) {
    let steer = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) steer -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) steer += 1;
    if (steer === 0 && this.mouseSeen && now - this.lastMouseMove < 4000) {
      steer = Math.max(-1, Math.min(1, (this.mouseX - 0.5) * 2.4));
      if (Math.abs(steer) < 0.06) steer = 0;
    }

    let throttleDelta = 0;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) throttleDelta += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) throttleDelta -= 1;
    if (this.mouseDown) throttleDelta += 1;

    let climb = 0;
    if (this.mouseSeen && now - this.lastMouseMove < 4000) {
      climb = Math.max(-1, Math.min(1, (0.5 - this.mouseY) * 2.2));
      if (Math.abs(climb) < 0.08) climb = 0;
    }

    return { steer, throttleDelta, climb };
  }

  // Call at the end of each frame so unconsumed single presses do not linger.
  endFrame() {
    this.pressed.clear();
  }
}
