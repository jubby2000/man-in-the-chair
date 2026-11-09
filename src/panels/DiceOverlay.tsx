import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useStore } from '../store/useStore';
import { diceToRender, combineFaces, rollLabel, type RollResult, type RenderDie } from '../lib/dice';
import { faceMapFor, geometryFor, readDie, d4CornerLabels, d4RestsFlat, type FaceMap } from '../lib/diceGeometry';
import { playClack, preloadDiceSound, setDiceMuted, isDiceMuted } from '../lib/diceSound';
import { useDiceSetStore, type DiceSet } from '../theme/diceSets';

const GRAVITY = -40;
const FLOOR_Y = 0;
const RESTITUTION = 0.5; // bounciness (0 = dead, 1 = perfectly elastic)
const FRICTION = 0.3;
const SETTLE_SPEED = 0.2; // below this linear+angular speed a die is "resting"
const SETTLE_FRAMES = 10; // consecutive calm frames before we lock a value
const MAX_ROLL_MS = 5000; // hard cap: force-settle after this so UI never hangs
// Tray half-extents (world units). Walls bound this box; dice spawn inside it.
const TRAY_HALF_X = 6;
const TRAY_HALF_Z = 4;

// Shared physics materials so die<->ground / die<->die ContactMaterials control bounce.
const DIE_MAT = new CANNON.Material('die');
const GROUND_MAT = new CANNON.Material('ground');

interface DieHandle {
  sides: number;
  index: number;
  faces: FaceMap[];
  body: CANNON.Body;
  render: RenderDie;
  /** times this die was nudged off a wall (d4 only) */
  nudges: number;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

const MAX_NUDGES = 5;

/**
 * A uniformly random rotation (Shoemake's method). Random Euler angles are NOT
 * uniform: they favour some orientations, and a short drop doesn't always
 * tumble enough to wash that out, which biased the results.
 */
function randomQuaternion(): CANNON.Quaternion {
  const u1 = Math.random(), u2 = Math.random() * 2 * Math.PI, u3 = Math.random() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  return new CANNON.Quaternion(a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3));
}

/**
 * A d4 that comes to rest leaning on a tray wall has no flat face down, so its
 * top corner is unclear. Like a player would, nudge it away from the wall with
 * a little spin. Returns true if any die was nudged. After MAX_NUDGES the die
 * is read where it lies (its highest corner still wins).
 */
function nudgeCockedD4s(handles: DieHandle[]): boolean {
  let nudged = false;
  for (const h of handles) {
    if (h.sides !== 4 || h.nudges >= MAX_NUDGES) continue;
    const b = h.body;
    const q = new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    if (d4RestsFlat(q, b.position.y, FLOOR_Y)) continue;
    h.nudges++;
    b.wakeUp();
    b.velocity.set(-Math.sign(b.position.x) * rand(3.5, 5), rand(3, 4.5), -Math.sign(b.position.z) * rand(3.5, 5));
    b.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    nudged = true;
  }
  return nudged;
}

// Build a cannon body approximating the die, sized to its three.js geometry.
function makeBody(sides: number): CANNON.Body {
  const body = new CANNON.Body({ mass: 1, material: DIE_MAT });
  let shape: CANNON.Shape;
  if (sides === 6) {
    shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
  } else {
    const geo = geometryFor(sides);
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
    const pos = nonIndexed.getAttribute('position');
    const verts: CANNON.Vec3[] = [];
    const faces: number[][] = [];
    const keyOf = (x: number, y: number, z: number) =>
      `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    const map = new Map<string, number>();
    for (let i = 0; i < pos.count; i += 3) {
      const tri: number[] = [];
      for (let j = 0; j < 3; j++) {
        const x = pos.getX(i + j), y = pos.getY(i + j), z = pos.getZ(i + j);
        const k = keyOf(x, y, z);
        let idx = map.get(k);
        if (idx === undefined) {
          idx = verts.length;
          map.set(k, idx);
          verts.push(new CANNON.Vec3(x, y, z));
        }
        tri.push(idx);
      }
      faces.push(tri);
    }
    geo.dispose();
    shape = new CANNON.ConvexPolyhedron({ vertices: verts, faces });
  }
  body.addShape(shape);
  body.allowSleep = true;
  body.sleepSpeedLimit = SETTLE_SPEED;
  body.sleepTimeLimit = 0.15;
  return body;
}

// Orientation that makes a label's +Z face point outward along `normal`.
function labelQuaternion(normal: THREE.Vector3): THREE.Quaternion {
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  return q;
}

/** One die: a mesh + a number label on every face, synced to its physics body. */
function Die({ handle, set }: { handle: DieHandle; set: DiceSet }) {
  const groupRef = useRef<THREE.Group>(null);
  const color = set.textureDataUrl ? '#ffffff' : set.body;
  const geometry = useMemo(() => geometryFor(handle.sides), [handle.sides]);
  // d4: three corner numbers per face instead of one central label
  const d4Labels = useMemo(() => (handle.sides === 4 ? d4CornerLabels() : []), [handle.sides]);
  // d10 kite faces are narrow and taper to a point, so they need a smaller
  // label than the broad faces of a d6/d8.
  const labelSize = handle.sides === 10 ? 0.26 : handle.sides === 20 || handle.sides === 12 ? 0.34 : 0.4;

  // load the custom image (if any) as a texture, once per data URL
  const texture = useMemo(() => {
    if (!set.textureDataUrl) return null;
    const tex = new THREE.TextureLoader().load(set.textureDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, [set.textureDataUrl]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const b = handle.body;
    g.position.set(b.position.x, b.position.y, b.position.z);
    g.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color={color}
          map={texture ?? undefined}
          emissive={texture ? '#000000' : color}
          emissiveIntensity={texture ? 0 : set.emissiveIntensity}
          metalness={set.metalness}
          roughness={set.roughness}
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
      {handle.sides === 4
        ? d4Labels.map((l, i) => (
            <Text
              key={i}
              position={[l.position.x, l.position.y, l.position.z]}
              quaternion={l.quaternion}
              fontSize={0.34}
              color={set.ink}
              anchorX="center"
              anchorY="middle"
              outlineWidth={set.outline ? 0.01 : 0}
              outlineColor={set.outline ?? '#000000'}
            >
              {l.value}
            </Text>
          ))
        : handle.faces.map((f, i) => {
        // sit the label just off the surface along the face normal (avoids
        // z-fighting and keeps it on the visible side of the mesh)
        const pos = f.center.clone().add(f.normal.clone().multiplyScalar(0.03));
        const quat = labelQuaternion(f.normal);
        return (
          <Text
            key={i}
            position={[pos.x, pos.y, pos.z]}
            quaternion={quat}
            fontSize={labelSize}
            color={set.ink}
            anchorX="center"
            anchorY="middle"
            outlineWidth={set.outline ? 0.012 : 0}
            outlineColor={set.outline ?? '#000000'}
          >
            {f.value}
          </Text>
        );
      })}
    </group>
  );
}

function DiceScene({
  result,
  set,
  onSettled,
}: {
  result: RollResult;
  set: DiceSet;
  onSettled: (total: number, values: number[]) => void;
}) {
  const specs = useMemo(() => diceToRender(result), [result]);
  const worldRef = useRef<CANNON.World>();
  const [handles, setHandles] = useState<DieHandle[]>([]);
  const calmFrames = useRef(0);
  const startTime = useRef(performance.now());
  const settled = useRef(false);

  useEffect(() => {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 14;
    world.allowSleep = true;

    world.addContactMaterial(
      new CANNON.ContactMaterial(DIE_MAT, GROUND_MAT, { restitution: RESTITUTION, friction: FRICTION }),
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(DIE_MAT, DIE_MAT, { restitution: RESTITUTION * 0.8, friction: FRICTION }),
    );

    const ground = new CANNON.Body({ mass: 0, material: GROUND_MAT });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.set(0, FLOOR_Y, 0);
    world.addBody(ground);

    const wall = (x: number, z: number, ry: number) => {
      const b = new CANNON.Body({ mass: 0, material: GROUND_MAT });
      b.addShape(new CANNON.Plane());
      b.quaternion.setFromEuler(0, ry, 0);
      b.position.set(x, 0, z);
      world.addBody(b);
    };
    // Box walls at the tray extents keep every die on screen.
    wall(-TRAY_HALF_X, 0, Math.PI / 2);
    wall(TRAY_HALF_X, 0, -Math.PI / 2);
    wall(0, -TRAY_HALF_Z, 0);
    wall(0, TRAY_HALF_Z, Math.PI);
    // a ceiling so a hard throw can't launch a die out the top
    const ceiling = new CANNON.Body({ mass: 0, material: GROUND_MAT });
    ceiling.addShape(new CANNON.Plane());
    ceiling.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    ceiling.position.set(0, 10, 0);
    world.addBody(ceiling);

    // start decoding the impact sample now, before the first collision lands
    preloadDiceSound();
    const built: DieHandle[] = specs.map((d, index) => {
      const geometry = geometryFor(d.sides);
      const faces = faceMapFor(d.sides, geometry);
      geometry.dispose();
      const body = makeBody(d.sides);
      // spawn inside the tray, above the floor, thrown gently inward
      const cols = 4;
      const col = index % cols;
      const spawnX = ((col - (cols - 1) / 2) / (cols / 2)) * (TRAY_HALF_X - 1.5) + rand(-0.3, 0.3);
      const spawnZ = rand(-(TRAY_HALF_Z - 1.5), TRAY_HALF_Z - 1.5);
      body.position.set(spawnX, 5 + Math.random() * 2, spawnZ);
      // bias velocity toward the tray center so dice don't pile on a wall
      body.velocity.set(-spawnX * 0.6 + rand(-2, 2), rand(-1, 1), -spawnZ * 0.6 + rand(-2, 2));
      body.angularVelocity.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
      body.quaternion.copy(randomQuaternion());
      body.addEventListener('collide', (e: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v <= 1.5) return;
        const strength = Math.min(1, v / 14);
        // walls/floor/ceiling are static (mass 0); anything with mass is a die
        const hitDie = e.body.mass > 0;
        if (hitDie) {
          // a die-die contact fires on BOTH dice; let only the lower id play it
          if (body.id < e.body.id) playClack(strength, 'die');
        } else {
          playClack(strength, 'table');
        }
      });
      world.addBody(body);
      return { sides: d.sides, index, faces, body, render: d, nudges: 0 };
    });

    worldRef.current = world;
    calmFrames.current = 0;
    startTime.current = performance.now();
    settled.current = false;
    setHandles(built);

    return () => {
      built.forEach((h) => world.removeBody(h.body));
      setHandles([]);
    };
  }, [specs]);

  useFrame((_, delta) => {
    const world = worldRef.current;
    if (!world || settled.current || handles.length === 0) return;
    world.step(1 / 60, Math.min(delta, 1 / 30), 3);

    let moving = false;
    for (const h of handles) {
      const speed = h.body.velocity.length() + h.body.angularVelocity.length();
      if (speed > SETTLE_SPEED) moving = true;
    }

    const elapsed = performance.now() - startTime.current;
    calmFrames.current = moving ? 0 : calmFrames.current + 1;

    if (calmFrames.current >= SETTLE_FRAMES && elapsed <= MAX_ROLL_MS && nudgeCockedD4s(handles)) {
      calmFrames.current = 0; // a cocked d4 was nudged off the wall; let it settle again
      return;
    }

    if (calmFrames.current >= SETTLE_FRAMES || elapsed > MAX_ROLL_MS) {
      settled.current = true;
      // raw up-face per physical die, in handle order
      const rawFaces = handles.map((h) => {
        const q = new THREE.Quaternion(
          h.body.quaternion.x,
          h.body.quaternion.y,
          h.body.quaternion.z,
          h.body.quaternion.w,
        );
        return readDie(h.sides, h.faces, q);
      });
      const renderDice = handles.map((h) => h.render);
      const total = combineFaces(result, renderDice, rawFaces);
      // Display values: pair up d100 tens/ones into one percentile reading.
      const display = displayFaces(renderDice, rawFaces);
      onSettled(total, display);
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#2a2a33', 0.95]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 14, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-6, 10, -4]} intensity={0.7} />
      {handles.map((h) => (
        <Die key={h.index} handle={h} set={set} />
      ))}
    </>
  );
}

// Collapse the raw per-physical-die faces into reader-friendly values: a d100
// pair (tens+ones) becomes one percentile number; a plain d10's 0 reads as 10.
function displayFaces(render: RenderDie[], raw: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < render.length; ) {
    const r = render[i];
    if (r.role === 'tens') {
      const pct = raw[i] * 10 + raw[i + 1];
      out.push(pct === 0 ? 100 : pct);
      i += 2;
    } else {
      out.push(r.sides === 10 && raw[i] === 0 ? 10 : raw[i]);
      i += 1;
    }
  }
  return out;
}

export function DiceOverlay() {
  const result = useStore((s) => s.diceOverlay);
  const clearDice = useStore((s) => s.clearDice);
  const recordLanded = useStore((s) => s.recordLanded);
  const diceSet = useDiceSetStore((s) => s.current());
  const diceSetLoaded = useDiceSetStore((s) => s.loaded);
  const [landed, setLanded] = useState<{ total: number; values: number[] } | null>(null);
  const [muted, setMuted] = useState(isDiceMuted());

  useEffect(() => {
    setLanded(null);
  }, [result]);

  // wait for the saved dice set, so a roll right after load isn't thrown in the default
  if (!result || !diceSetLoaded) return null;

  return (
    <div className="dice-overlay" onClick={clearDice} role="button" aria-label="Dismiss roll">
      <button
        className="dice-mute"
        title={muted ? 'Unmute dice' : 'Mute dice'}
        onClick={(e) => {
          e.stopPropagation();
          const next = !muted;
          setMuted(next);
          setDiceMuted(next);
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="dice-canvas">
        <Canvas shadows camera={{ position: [0, 15, 5], fov: 45 }} dpr={[1, 2]}>
          <DiceScene
            result={result}
            set={diceSet}
            onSettled={(total, values) => {
              setLanded({ total, values });
              recordLanded(result.notation, total, values);
            }}
          />
        </Canvas>
      </div>

      <div className="notation-readout">{rollLabel(result.notation)}</div>
      {landed ? (
        <>
          <div className="total-readout">{landed.total}</div>
          <div className="breakdown">
            faces: {landed.values.join(', ')}
            {result.modifier ? `  ${result.modifier >= 0 ? '+' : ''}${result.modifier}` : ''}
          </div>
          <div className="dismiss-hint">click anywhere to dismiss</div>
        </>
      ) : (
        <div className="rolling-hint">rolling…</div>
      )}
    </div>
  );
}
