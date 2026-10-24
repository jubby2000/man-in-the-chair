import * as THREE from 'three';

// For each die type we keep a list of { normal, value }: the outward normal of
// a face (in the die's local space) and the pip/number that face represents.
// After the die settles we find which face normal points most toward world-up
// and read its value — that is the "face that appears".

export interface FaceMap {
  normal: THREE.Vector3;
  value: number;
}

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).normalize();
}

// ---- d6: a cube. Standard opposite faces sum to 7. ----
const D6_FACES: FaceMap[] = [
  { normal: v(0, 1, 0), value: 1 },
  { normal: v(0, -1, 0), value: 6 },
  { normal: v(1, 0, 0), value: 3 },
  { normal: v(-1, 0, 0), value: 4 },
  { normal: v(0, 0, 1), value: 2 },
  { normal: v(0, 0, -1), value: 5 },
];

// For dice whose true geometry is awkward to label (d4/d8/d10/d12/d20), we use
// the polyhedron's face normals and assign values 1..N around them. The
// specific labeling is arbitrary but consistent, so a given resting orientation
// always yields the same value — which is what matters for fair, readable rolls.
function polyhedronFaces(geometry: THREE.BufferGeometry, sides: number): FaceMap[] {
  const pos = geometry.getAttribute('position');
  const faces: THREE.Vector3[] = [];
  const seen: THREE.Vector3[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    tmpA.fromBufferAttribute(pos, i);
    tmpB.fromBufferAttribute(pos, i + 1);
    tmpC.fromBufferAttribute(pos, i + 2);
    tmpB.sub(tmpA);
    tmpC.sub(tmpA);
    normal.crossVectors(tmpB, tmpC).normalize();
    // de-duplicate coplanar triangles that share a face normal
    const dup = seen.find((n) => n.dot(normal) > 0.999);
    if (!dup) {
      seen.push(normal.clone());
      faces.push(normal.clone());
    }
  }

  // Assign 1..sides to the first `sides` distinct normals.
  return faces.slice(0, sides).map((n, i) => ({ normal: n, value: (i % sides) + 1 }));
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
