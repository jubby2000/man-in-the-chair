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

export function faceMapFor(sides: number, geometry: THREE.BufferGeometry): FaceMap[] {
  const cached = cache.get(sides);
  if (cached) return cached;
  const map = sides === 6 ? D6_FACES : polyhedronFaces(geometry, sides);
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

/** Geometry for each die type (also used as the physics collision proxy). */
export function geometryFor(sides: number): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(0.85);
    case 6:
      return new THREE.BoxGeometry(1, 1, 1);
    case 8:
      return new THREE.OctahedronGeometry(0.8);
    case 12:
      return new THREE.DodecahedronGeometry(0.78);
    default:
      return new THREE.IcosahedronGeometry(0.8); // d10, d20, d100
  }
}
