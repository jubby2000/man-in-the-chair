import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useStore } from '../store/useStore';
import { diceToRender, combineFaces, type RollResult, type RenderDie } from '../lib/dice';
import { faceMapFor, geometryFor, readUpFace, type FaceMap } from '../lib/diceGeometry';
import { playClack, setDiceMuted, isDiceMuted } from '../lib/diceSound';

const GRAVITY = -30;
const FLOOR_Y = -4;
const RESTITUTION = 0.55; // bounciness (0 = dead, 1 = perfectly elastic)
const FRICTION = 0.25;
const SETTLE_SPEED = 0.2; // below this linear+angular speed a die is "resting"
const SETTLE_FRAMES = 10; // consecutive calm frames before we lock a value
const MAX_ROLL_MS = 5000; // hard cap: force-settle after this so UI never hangs

// Shared physics materials so die<->ground / die<->die ContactMaterials control bounce.
const DIE_MAT = new CANNON.Material('die');
const GROUND_MAT = new CANNON.Material('ground');

// Per-die-type face colors.
const DIE_COLORS: Record<number, string> = {
  4: '#e07a5f',
  6: '#c86bff',
  8: '#4dd2c0',
  10: '#f2c14e',
  12: '#6ba8ff',
  20: '#c2f04a',
  100: '#f2c14e',
};

interface DieHandle {
  sides: number;
  index: number;
  faces: FaceMap[];
  body: CANNON.Body;
  render: RenderDie;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
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
function Die({ handle }: { handle: DieHandle }) {
  const groupRef = useRef<THREE.Group>(null);
  const color = DIE_COLORS[handle.sides] ?? '#c86bff';
  const geometry = useMemo(() => geometryFor(handle.sides), [handle.sides]);
  const labelSize = handle.sides === 20 || handle.sides === 12 ? 0.34 : 0.4;

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
          emissive={color}
          emissiveIntensity={0.1}
          metalness={0.15}
          roughness={0.45}
          flatShading
        />
      </mesh>
      {handle.faces.map((f, i) => {
        // push the label just off the surface so it isn't z-fighting
        const pos = f.center.clone().add(f.normal.clone().multiplyScalar(0.02));
        const quat = labelQuaternion(f.normal);
        return (
          <Text
            key={i}
            position={[pos.x, pos.y, pos.z]}
            quaternion={quat}
            fontSize={labelSize}
            color="#0a0c0f"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#ffffff"
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
  onSettled,
}: {
  result: RollResult;
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
    wall(-7, 0, Math.PI / 2);
    wall(7, 0, -Math.PI / 2);
    wall(0, -6, 0);
    wall(0, 6, Math.PI);

    const built: DieHandle[] = specs.map((d, index) => {
      const geometry = geometryFor(d.sides);
      const faces = faceMapFor(d.sides, geometry);
      geometry.dispose();
      const body = makeBody(d.sides);
      const col = index % 4;
      body.position.set((col - 1.5) * 2.2 + rand(-0.4, 0.4), 5 + Math.random() * 2.5, rand(-1, 1));
      body.velocity.set(rand(-4, 4), rand(-2, 1), rand(-4, 4));
      body.angularVelocity.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
      body.quaternion.setFromEuler(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 1.5) playClack(Math.min(1, v / 14));
      });
      world.addBody(body);
      return { sides: d.sides, index, faces, body, render: d };
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
        return readUpFace(h.faces, q);
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
      <directionalLight position={[4, 10, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 6, -4]} intensity={0.7} />
      <pointLight position={[0, -3, 5]} intensity={0.5} color="#c2f04a" />
      {handles.map((h) => (
        <Die key={h.index} handle={h} />
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
  const [landed, setLanded] = useState<{ total: number; values: number[] } | null>(null);
  const [muted, setMuted] = useState(isDiceMuted());

  useEffect(() => {
    setLanded(null);
  }, [result]);

  if (!result) return null;

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
        <Canvas shadows camera={{ position: [0, 7, 11], fov: 45 }} dpr={[1, 2]}>
          <DiceScene
            result={result}
            onSettled={(total, values) => {
              setLanded({ total, values });
              recordLanded(result.notation, total, values);
            }}
          />
        </Canvas>
      </div>

      <div className="notation-readout">{result.notation.toUpperCase()}</div>
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
