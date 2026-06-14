/**
 * Build-time geometry bake for the PRIVACY wireframe.
 *
 * We generate the extruded 3D text + its wireframe edges with three.js HERE (in
 * Node — no GPU/presentation involved, just math) and write the line-segment
 * positions to a JSON file. The runtime then renders those segments with a raw
 * WebGL2 context (the only path that actually presents on this machine's ANGLE
 * driver — three's WebGLRenderer / R3F does not composite here).
 *
 * Font: three's bundled helvetiker_bold typeface (Rigid Square has no offline
 * OTF->typeface.json converter available; helvetiker bold is the cleanest
 * geometric face shipped with three).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

const fontPath = "node_modules/three/examples/fonts/helvetiker_bold.typeface.json";
const font = new Font(JSON.parse(readFileSync(fontPath, "utf8")));

const geo = new TextGeometry("PRIVACY", {
  font,
  size: 1,
  depth: 0.28,
  curveSegments: 5,
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.015,
  bevelSegments: 1,
});
geo.center();
geo.computeBoundingBox();
const bb = geo.boundingBox;

const edges = new THREE.EdgesGeometry(geo, 1); // remove coplanar face triangulation
const pos = Array.from(edges.getAttribute("position").array);

mkdirSync("public", { recursive: true });
const out = {
  positions: pos,
  bbox: { min: bb.min.toArray(), max: bb.max.toArray() },
  font: "helvetiker_bold (three bundled)",
};
writeFileSync("public/privacy-edges.json", JSON.stringify(out));
console.log(
  `baked PRIVACY: ${pos.length / 3} verts, ${pos.length / 6} segments, ` +
    `size ${(bb.max.x - bb.min.x).toFixed(2)} x ${(bb.max.y - bb.min.y).toFixed(2)}, ` +
    `json ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`,
);
