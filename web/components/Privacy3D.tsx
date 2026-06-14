"use client";

import { useEffect, useRef } from "react";

/**
 * "PRIVACY" as an extruded 3D wireframe, rendered in raw WebGL2 (gl.LINES) from
 * geometry baked at build time (scripts/bake-privacy.mjs). We deliberately avoid
 * three's WebGLRenderer / R3F: it does not present on this machine's ANGLE/D3D11
 * driver. Thin white edges, transparent background, mouse-parallax rotation with
 * lerp smoothing, light idle drift. Paused off-viewport / on reduced motion.
 */

// --- minimal column-major mat4 helpers ---
function multiply(a: number[], b: number[]): number[] {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function perspective(fovy: number, aspect: number, near: number, far: number): number[] {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function translation(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}
function rotationX(a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}
function rotationY(a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

const VERT = `#version 300 es
in vec3 p;
uniform mat4 mvp;
void main() { gl_Position = mvp * vec4(p, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform float alpha;
// Warm thermal "hot" edge color (iron palette peak) for the wireframe.
void main() { o = vec4(1.0, 0.82, 0.45, alpha); }`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error("Privacy3D shader:", gl.getShaderInfoLog(s));
  return s;
}

export default function Privacy3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.error("Privacy3D: WebGL2 not available");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const uMvp = gl.getUniformLocation(prog, "mvp");
    const uAlpha = gl.getUniformLocation(prog, "alpha");
    const loc = gl.getAttribLocation(prog, "p");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let count = 0;
    let halfW = 3;
    let halfH = 0.6;
    let disposed = false;
    let raf = 0;
    let inView = true;

    // geometry size + camera distance (recomputed on resize)
    let dist = 6;
    let aspect = 1;
    const fov = (38 * Math.PI) / 180;

    const computeDist = () => {
      // fit the word's width and height into view with margin
      const dW = (halfW * 1.25) / (Math.tan(fov / 2) * Math.max(aspect, 0.1));
      const dH = (halfH * 1.6) / Math.tan(fov / 2);
      dist = Math.max(dW, dH, 2.2);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      aspect = w / h;
      computeDist();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0 });
    io.observe(canvas);

    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const rot = { x: 0, y: 0 };
    const start = performance.now();

    const draw = () => {
      const t = (performance.now() - start) / 1000;
      const idle = reduced ? 0 : Math.sin(t * 0.3) * 0.12;
      const targetY = reduced ? 0 : mouse.x * 0.45 + idle;
      const targetX = reduced ? 0 : mouse.y * 0.28;
      rot.y += (targetY - rot.y) * 0.08;
      rot.x += (targetX - rot.x) * 0.08;

      const model = multiply(rotationX(rot.x), rotationY(rot.y));
      const view = multiply(translation(0, 0, -dist), model);
      const mvp = multiply(perspective(fov, aspect, 0.1, 100), view);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(uMvp, false, new Float32Array(mvp));
      gl.uniform1f(uAlpha, 0.72);
      if (count > 0) gl.drawArrays(gl.LINES, 0, count);
    };

    const loop = () => {
      if (!disposed && inView && !document.hidden) draw();
      raf = requestAnimationFrame(loop);
    };

    fetch("/privacy-edges.json")
      .then((r) => r.json())
      .then((data: { positions: number[]; bbox: { min: number[]; max: number[] } }) => {
        if (disposed) return;
        const arr = new Float32Array(data.positions);
        count = arr.length / 3;
        halfW = (data.bbox.max[0] - data.bbox.min[0]) / 2;
        halfH = (data.bbox.max[1] - data.bbox.min[1]) / 2;
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        resize();
        draw(); // first frame even if reduced motion
        if (!reduced) raf = requestAnimationFrame(loop);
      })
      .catch((e) => console.error("Privacy3D load:", e));

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
