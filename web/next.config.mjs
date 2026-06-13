/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js dev indicator (the round "N" bottom-left). Dev-only anyway.
  devIndicators: false,
  // React Three Fiber v9 + React 19: StrictMode double-mounts in dev and the
  // discarded mount's cleanup cancels the rAF render loop, freezing the WebGL
  // canvas on its first frame. Disabling StrictMode keeps the Dither loop alive.
  reactStrictMode: false,
};

export default nextConfig;
