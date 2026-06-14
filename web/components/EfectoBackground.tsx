"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Variant B background (branch `background-efecto`).
 *
 * Reproduces the Efecto FX thermal direction (gradient-mapping with bright white
 * + yellow hot points) via a raw WebGL2 shader colorRamp — NOT the React Bits
 * Dither. A smooth flowing heat field (no Bayer dither / pixelation), mapped
 * through an iron ramp that peaks on yellow then white, with a soft hot bloom.
 *
 * Raw WebGL2 (not three/R3F) because R3F does not present on this ANGLE/D3D11
 * GPU. Paused off-viewport / tab-hidden, frozen on reduced motion, dpr capped.
 */

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 resolution;
uniform float time;

// value-noise fBm (smooth heat field)
vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dot(hash(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)),
                 dot(hash(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x),
             mix(dot(hash(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)),
                 dot(hash(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

// Thermal gradient map: cold -> dark red -> orange -> yellow -> white peak.
vec3 thermal(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.02, 0.0, 0.0);
  vec3 c1 = vec3(0.35, 0.04, 0.0);
  vec3 c2 = vec3(1.0, 0.30, 0.0);
  vec3 c3 = vec3(1.0, 0.92, 0.10);  // yellow #ffec00
  vec3 c4 = vec3(1.0, 1.0, 1.0);    // white peak
  if (t < 0.30) return mix(c0, c1, t / 0.30);
  if (t < 0.60) return mix(c1, c2, (t - 0.30) / 0.30);
  if (t < 0.85) return mix(c2, c3, (t - 0.60) / 0.25);
  return mix(c3, c4, (t - 0.85) / 0.15);
}

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv.x *= resolution.x / resolution.y;
  vec2 q = uv * 2.6;
  // domain-warped flowing heat
  float t = time * 0.06;
  vec2 warp = vec2(fbm(q + vec2(t, -t)), fbm(q + vec2(-t, t) + 5.2));
  float h = fbm(q + warp * 1.4 + vec2(0.0, t * 0.5));
  h = smoothstep(-0.6, 0.8, h);
  vec3 col = thermal(h);
  // soft hot bloom on the peaks
  col += pow(max(h - 0.72, 0.0), 2.0) * 2.2 * vec3(1.0, 0.85, 0.45);
  fragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error("EfectoBackground shader:", gl.getShaderInfoLog(s));
  return s;
}

export function DitherBackground() {
  // Exported under the same name as variant A so layout.tsx imports identically;
  // only this file differs between the two background branches.
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;position:absolute;inset:0";
    wrap.appendChild(canvas);
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) {
      console.error("EfectoBackground: WebGL2 not available");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "resolution");
    const uTime = gl.getUniformLocation(prog, "time");

    let w = 1;
    let h = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(canvas);

    let raf = 0;
    const start = performance.now();
    const render = () => {
      if (visible && !document.hidden) {
        const t = reduced ? 0 : (performance.now() - start) / 1000;
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uTime, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(render);
    };
    render();
    if (reduced) cancelAnimationFrame(raf); // single static frame

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      canvas.remove();
    };
  }, []);

  return <div ref={wrapRef} className="absolute inset-0 z-0 h-full w-full" aria-hidden />;
}
