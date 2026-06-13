"use client";
/* eslint-disable react/no-unknown-property */
import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import "./Dither.css";

// Single-pass dithered waves. The original React Bits version rendered the wave
// to a texture and applied an ordered-dither post-process via
// @react-three/postprocessing's EffectComposer. That composer takes over R3F's
// render loop through a priority useFrame, and that takeover does NOT survive
// dev re-mounts (StrictMode double-mount / Fast Refresh) — the loop dies and the
// canvas freezes on its first frame. Here the wave + Bayer dither are merged into
// one fullscreen fragment shader and driven by a component-owned rAF loop that
// calls gl.render() directly, so animation is immune to R3F loop lifecycle.

const vertexShader = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
out vec4 fragColor;

uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;
uniform float colorNum;
uniform float pixelSize;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 fragCoord, vec3 color) {
  vec2 scaledCoord = floor(fragCoord / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  // pixelate the sampling coordinate (matches the original post-process pass)
  vec2 pixelCoord = (floor(fragCoord / pixelSize) + 0.5) * pixelSize;
  vec2 uv = pixelCoord / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

  float f = pattern(uv);

  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }

  vec3 col = mix(vec3(0.0), waveColor, f);
  col = dither(fragCoord, col);
  fragColor = vec4(col, 1.0);
}
`;

function DitheredWaves({
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  waveColor,
  colorNum,
  pixelSize,
  disableAnimation,
  enableMouseInteraction,
  mouseRadius,
}) {
  const meshRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const startRef = useRef(0);
  const prevColorRef = useRef([...waveColor]);
  const { gl, size, viewport } = useThree();

  // Latest props in a ref so the rAF loop always reads current values without
  // restarting on every prop change.
  const propsRef = useRef({});
  propsRef.current = {
    waveSpeed,
    waveFrequency,
    waveAmplitude,
    waveColor,
    colorNum,
    pixelSize,
    disableAnimation,
    enableMouseInteraction,
    mouseRadius,
  };

  const uniformsRef = useRef({
    time: new THREE.Uniform(0),
    resolution: new THREE.Uniform(new THREE.Vector2(0, 0)),
    waveSpeed: new THREE.Uniform(waveSpeed),
    waveFrequency: new THREE.Uniform(waveFrequency),
    waveAmplitude: new THREE.Uniform(waveAmplitude),
    waveColor: new THREE.Uniform(new THREE.Color(...waveColor)),
    mousePos: new THREE.Uniform(new THREE.Vector2(0, 0)),
    enableMouseInteraction: new THREE.Uniform(enableMouseInteraction ? 1 : 0),
    mouseRadius: new THREE.Uniform(mouseRadius),
    colorNum: new THREE.Uniform(colorNum),
    pixelSize: new THREE.Uniform(pixelSize),
  });

  // Keep resolution in sync with the drawing buffer.
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.floor(size.width * dpr);
    const h = Math.floor(size.height * dpr);
    uniformsRef.current.resolution.value.set(w, h);
  }, [size, gl]);

  // Track the pointer at the window level so the ripple is felt across the whole
  // central block, even where content sits above the canvas.
  useEffect(() => {
    const onPointerMove = (e) => {
      if (!propsRef.current.enableMouseInteraction) return;
      const rect = gl.domElement.getBoundingClientRect();
      const dpr = gl.getPixelRatio();
      mouseRef.current.set((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [gl]);

  // Canonical R3F render loop: frameloop="always" calls this every frame and R3F
  // renders the scene itself (no EffectComposer, no manual gl.render). We only
  // push the latest prop values into the uniforms here.
  useFrame(({ clock }) => {
    const u = uniformsRef.current;
    const p = propsRef.current;

    if (startRef.current === 0) startRef.current = clock.getElapsedTime();
    if (!p.disableAnimation) {
      u.time.value = clock.getElapsedTime() - startRef.current;
    }

    // Diagnostic: lets us read the loop state from the browser console.
    if (typeof window !== "undefined") {
      window.__dither = window.__dither || {};
      window.__dither.tick = (window.__dither.tick || 0) + 1;
      window.__dither.time = u.time.value;
    }

    u.waveSpeed.value = p.waveSpeed;
    u.waveFrequency.value = p.waveFrequency;
    u.waveAmplitude.value = p.waveAmplitude;
    u.colorNum.value = p.colorNum;
    u.pixelSize.value = p.pixelSize;
    u.mouseRadius.value = p.mouseRadius;
    u.enableMouseInteraction.value = p.enableMouseInteraction ? 1 : 0;

    const prevColor = prevColorRef.current;
    if (!prevColor.every((v, i) => v === p.waveColor[i])) {
      u.waveColor.value.set(...p.waveColor);
      prevColorRef.current = [...p.waveColor];
    }

    if (p.enableMouseInteraction) {
      u.mousePos.value.copy(mouseRef.current);
    }
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniformsRef.current}
        glslVersion={THREE.GLSL3}
      />
    </mesh>
  );
}

export default function Dither({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.5, 0.5, 0.5],
  colorNum = 4,
  pixelSize = 2,
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 1,
}) {
  return (
    <Canvas
      className="dither-container"
      frameloop="always"
      camera={{ position: [0, 0, 6] }}
      dpr={1}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <DitheredWaves
        waveSpeed={waveSpeed}
        waveFrequency={waveFrequency}
        waveAmplitude={waveAmplitude}
        waveColor={waveColor}
        colorNum={colorNum}
        pixelSize={pixelSize}
        disableAnimation={disableAnimation}
        enableMouseInteraction={enableMouseInteraction}
        mouseRadius={mouseRadius}
      />
    </Canvas>
  );
}
