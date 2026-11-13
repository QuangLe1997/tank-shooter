// data/player.js — PLAYER tank handling constants (accel, speed, dash, turn, base combat range)

export const PLAYER = {
  accel: 130, maxSpeed: 26, friction: 9, radius: 1.85,   // Z174b the real-length hull needs a wider collision circle
  dashSpeed: 70, dashTime: 0.26, dashCd: 1.4, dashIframe: 0.32,
  turnLerp: 14, rangeBase: 26,           // combat range: only fires + bullets only reach within this
};
