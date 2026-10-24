import * as THREE from 'three';

// For each die type we keep a list of { normal, center, value }: the outward
// normal of a face (die-local), the face centroid (die-local), and the number
// that face represents. After the die settles we find which face normal points
// most toward world-up and read its value — the "face that appears". The
// centroid lets us place a number label on every face.

export interface FaceMap {
  normal: THREE.Vector3;
  center: THREE.Vector3;
  value: number;
}

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).normalize();
}

// ---- d6: a cube of side 1 (half-extent 0.5). Opposite faces sum to 7. ----
const D6_FACES: FaceMap[] = [
  { normal: v(0, 1, 0), center: new THREE.Vector3(0, 0.5, 0), value: 1 },
  { normal: v(0, -1, 0), center: new THREE.Vector3(0, -0.5, 0), value: 6 },
  { normal: v(1, 0, 0), center: new THREE.Vector3(0.5, 0, 0), value: 3 },
  { normal: v(-1, 0, 0), center: new THREE.Vector3(-0.5, 0, 0), value: 4 },
  { normal: v(0, 0, 1), center: new THREE.Vector3(0, 0, 0.5), value: 2 },
  { normal: v(0, 0, -1), center: new THREE.Vector3(0, 0, -0.5), value: 5 },
];

// For dice whose true geometry is awkward to label (d4/d8/d10/d12/d20), we use
// the polyhedron's face normals and assign values 1..N around them. The
// specific labeling is arbitrary but consistent, so a given resting orientation
// always yields the same value — which is what matters for fair, readable rolls.
function polyhedronFaces(geometry: THREE.BufferGeometry, sides: number): FaceMap[] {
  const pos = geometry.getAttribute('position');
  const groups: { normal: THREE.Vector3; sum: THREE.Vector3; count: number }[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    tmpA.fromBufferAttribute(pos, i);
    tmpB.fromBufferAttribute(pos, i + 1);
    tmpC.fromBufferAttribute(pos, i + 2);
    edge1.subVectors(tmpB, tmpA);
    edge2.subVectors(tmpC, tmpA);
    normal.crossVectors(edge1, edge2).normalize();
    const triCentroid = new THREE.Vector3()
      .add(tmpA)
      .add(tmpB)
      .add(tmpC)
      .multiplyScalar(1 / 3);
    // group coplanar triangles that share a face normal (and are near each other)
    let g = groups.find((x) => x.normal.dot(normal) > 0.999);
    if (!g) {
      g = { normal: normal.clone(), sum: new THREE.Vector3(), count: 0 };
      groups.push(g);
    }
    g.sum.add(triCentroid);
    g.count += 1;
  }

  return groups.slice(0, sides).map((g, i) => ({
    normal: g.normal.clone(),
    center: g.sum.clone().multiplyScalar(1 / g.count),
    value: (i % sides) + 1,
  }));
}

const cache = new Map<number, FaceMap[]>();

// Exact 10-face map for the pentagonal trapezohedron, built from the same
// construction as d10Geometry so we always get 10 kite faces (triangle-normal
// grouping would split each non-coplanar kite into two).
function d10Faces(radius = 0.85): FaceMap[] {
  const top = new THREE.Vector3(0, radius, 0);
  const bottom = new THREE.Vector3(0, -radius, 0);
  const ringY = radius * 0.105;
  const ringR = radius * 0.92;
  const upper: THREE.Vector3[] = [];
  const lower: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const aU = (i / 5) * Math.PI * 2;
    const aL = aU + Math.PI / 5;
    upper.push(new THREE.Vector3(Math.cos(aU) * ringR, ringY, Math.sin(aU) * ringR));
    lower.push(new THREE.Vector3(Math.cos(aL) * ringR, -ringY, Math.sin(aL) * ringR));
  }
  const faces: FaceMap[] = [];
  // Standard d10 values 0..9. We alternate around the die so adjacent kites
  // aren't sequential (as on a real d10). Top kites get even-ish, bottom odd.
  const topVals = [0, 2, 4, 6, 8];
  const botVals = [1, 3, 5, 7, 9];
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    // top kite: top, upper[i], lower[i], upper[next]
    const tc = new THREE.Vector3()
      .add(top).add(upper[i]).add(lower[i]).add(upper[next]).multiplyScalar(0.25);
    faces.push({ normal: tc.clone().normalize(), center: tc, value: topVals[i] });
    // bottom kite: bottom, lower[i], upper[next], lower[next]
    const bc = new THREE.Vector3()
      .add(bottom).add(lower[i]).add(upper[next]).add(lower[next]).multiplyScalar(0.25);
    faces.push({ normal: bc.clone().normalize(), center: bc, value: botVals[i] });
  }
  return faces;
}

export function faceMapFor(sides: number, geometry: THREE.BufferGeometry): FaceMap[] {
  const cached = cache.get(sides);
  if (cached) return cached;
  const map = sides === 6 ? D6_FACES : sides === 10 ? d10Faces(0.85) : polyhedronFaces(geometry, sides);
  cache.set(sides, map);
  return map;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Read which face points most upward given the die's current quaternion. */
export function readUpFace(faces: FaceMap[], quaternion: THREE.Quaternion): number {
  let best = faces[0];
  let bestDot = -Infinity;
  const worldNormal = new THREE.Vector3();
  for (const f of faces) {
    worldNormal.copy(f.normal).applyQuaternion(quaternion);
    const d = worldNormal.dot(WORLD_UP);
    if (d > bestDot) {
      bestDot = d;
      best = f;
    }
  }
  return best.value;
}

/** A pentagonal trapezohedron: the real 10-faced d10 shape (10 kite faces). */
function d10Geometry(radius = 0.85): THREE.BufferGeometry {
  // Two apex points and two rings of 5 vertices, offset by 36°, at +/- a small
  // height — the standard d10 construction.
  const top = new THREE.Vector3(0, radius, 0);
  const bottom = new THREE.Vector3(0, -radius, 0);
  const ringY = radius * 0.105;
  const ringR = radius * 0.92;
  const upper: THREE.Vector3[] = [];
  const lower: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const aU = (i / 5) * Math.PI * 2;
    const aL = aU + Math.PI / 5; // offset 36°
    upper.push(new THREE.Vector3(Math.cos(aU) * ringR, ringY, Math.sin(aU) * ringR));
    lower.push(new THREE.Vector3(Math.cos(aL) * ringR, -ringY, Math.sin(aL) * ringR));
  }

  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  // Each kite face = two triangles. 5 kites around the top apex, 5 around bottom.
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    // top kite: top apex -> upper[i] -> lower[i] -> upper[next]
    pushTri(top, upper[i], lower[i]);
    pushTri(top, lower[i], upper[next]);
    // bottom kite: bottom apex -> lower[i] -> upper[next] -> lower[next]
    pushTri(bottom, lower[i], upper[next]);
    pushTri(bottom, upper[next], lower[next]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Geometry for each die type (also used as the physics collision proxy). */
export function geometryFor(sides: number): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(0.85);
    case 6:
      return new THREE.BoxGeometry(1, 1, 1);
    case 8:
      return new THREE.OctahedronGeometry(0.8);
    case 10:
      return d10Geometry(0.85);
    case 12:
      return new THREE.DodecahedronGeometry(0.78);
    default:
      return new THREE.IcosahedronGeometry(0.8); // d20 (and d100 handled as 2×d10)
  }
}
