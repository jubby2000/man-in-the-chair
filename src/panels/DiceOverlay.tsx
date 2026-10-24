import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useStore } from '../store/useStore';
import { diceToRender, type RollResult } from '../lib/dice';
import { faceMapFor, geometryFor, readUpFace, type FaceMap } from '../lib/diceGeometry';
import { playClack, setDiceMuted, isDiceMuted } from '../lib/diceSound';

const GRAVITY = -30;
const FLOOR_Y = -4;
const RESTITUTION = 0.55; // bounciness (0 = dead, 1 = perfectly elastic)
const FRICTION = 0.25;
const SETTLE_SPEED = 0.2; // below this linear+angular speed a die is "resting"
const SETTLE_FRAMES = 10; // consecutive calm frames before we lock a value
const MAX_ROLL_MS = 5000; // hard cap: force-settle after this so UI never hangs

interface DieSpec {
  sides: number;
  index: number;
}

// Shared physics materials so a die<->ground ContactMaterial can control bounce.
const DIE_MAT = new CANNON.Material('die');
const GROUND_MAT = new CANNON.Material('ground');

// Build a cannon body approximating the die, sized to its three.js geometry.
function makeBody(sides: number): CANNON.Body {
  const body = new CANNON.Body({ mass: 1, material: DIE_MAT });
  let shape: CANNON.Shape;
  if (sides === 6) {
    shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
  } else {
    // Convex polyhedron from the three geometry for non-cube dice.
    const geo = geometryFor(sides);
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
    const pos = nonIndexed.getAttribute('position');
    const verts: CANNON.Vec3[] = [];
    const faces: number[][] = [];
    const keyOf = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
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

// Per-die-type colors so the tray reads at a glance.
const DIE_COLORS: Record<number, string> = {
  4: '#e07a5f',
  6: '#c86bff',
  8: '#4dd2c0',
  10: '#f2c14e',
  12: '#6ba8ff',
  20: '#c2f04a',
  100: '#f2c14e',
};

// Draw numeric labels onto a canvas texture for a die (used on d6 faces where
// orientation is obvious; other dice rely on color + the readout).
function numberTexture(n: number, color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  // inset border so edges read as a die, not a flat sticker
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  ctx.fillStyle = '#0a0c0f';
  ctx.font = 'bold 74px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface DiceSceneHandle {
  onSettled: (total: number, values: number[]) => void;
}

function DiceScene({ result, onSettled }: { result: RollResult } & DiceSceneHandle) {
  const { scene } = useThree();
  const specs = useMemo<DieSpec[]>(
    () => diceToRender(result).map((d, index) => ({ sides: d.sides, index })),
    [result],
  );

  const worldRef = useRef<CANNON.World>();
  const diceRef = useRef<{ body: CANNON.Body; mesh: THREE.Mesh; faces: FaceMap[]; sides: number }[]>([]);
  const calmFrames = useRef(0);
  const startTime = useRef(performance.now());
  const settled = useRef(false);

  // Build world + dice once per result.
  useEffect(() => {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 14;
    world.allowSleep = true;

    // Contact behavior: this is what actually makes the dice bounce.
    const contact = new CANNON.ContactMaterial(DIE_MAT, GROUND_MAT, {
      restitution: RESTITUTION,
      friction: FRICTION,
    });
    world.addContactMaterial(contact);
    const dieDie = new CANNON.ContactMaterial(DIE_MAT, DIE_MAT, {
      restitution: RESTITUTION * 0.8,
      friction: FRICTION,
    });
    world.addContactMaterial(dieDie);

    const ground = new CANNON.Body({ mass: 0, material: GROUND_MAT });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.set(0, FLOOR_Y, 0);
    world.addBody(ground);

    // invisible containing walls so dice stay on screen
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

    const dice = specs.map((spec) => {
      const geometry = geometryFor(spec.sides);
      const faces = faceMapFor(spec.sides, geometry);
      const base = DIE_COLORS[spec.sides] ?? '#c86bff';
      const material =
        spec.sides === 6
          ? D6_MATERIALS(base)
          : new THREE.MeshStandardMaterial({
              color: base,
              emissive: base,
              emissiveIntensity: 0.12,
              metalness: 0.2,
              roughness: 0.4,
              flatShading: true,
              side: THREE.DoubleSide,
            });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      scene.add(mesh);

      const body = makeBody(spec.sides);
      // spawn above, spread across x, with a random throw + spin
      const col = spec.index % 4;
      body.position.set((col - 1.5) * 2.2 + rand(-0.4, 0.4), 5 + Math.random() * 2.5, rand(-1, 1));
      body.velocity.set(rand(-4, 4), rand(-2, 1), rand(-4, 4));
      body.angularVelocity.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
      body.quaternion.setFromEuler(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
      world.addBody(body);

      // play a clack on meaningful impacts, scaled by impact speed
      body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 1.5) playClack(Math.min(1, v / 14));
      });

      return { body, mesh, faces, sides: spec.sides };
    });

    worldRef.current = world;
    diceRef.current = dice;
    calmFrames.current = 0;
    startTime.current = performance.now();
    settled.current = false;

    return () => {
      dice.forEach((d) => {
        scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        (Array.isArray(d.mesh.material) ? d.mesh.material : [d.mesh.material]).forEach((m) => m.dispose());
      });
    };
  }, [specs, scene]);

  useFrame((_, delta) => {
    const world = worldRef.current;
    if (!world || settled.current) return;
    // fixed-step physics for stability & performance
    world.step(1 / 60, Math.min(delta, 1 / 30), 3);

    let moving = false;
    for (const d of diceRef.current) {
      d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
      d.mesh.quaternion.set(
        d.body.quaternion.x,
        d.body.quaternion.y,
        d.body.quaternion.z,
        d.body.quaternion.w,
      );
      const speed = d.body.velocity.length() + d.body.angularVelocity.length();
      if (speed > SETTLE_SPEED) moving = true;
    }

    const elapsed = performance.now() - startTime.current;
    if (!moving) calmFrames.current += 1;
    else calmFrames.current = 0;

    if (calmFrames.current >= SETTLE_FRAMES || elapsed > MAX_ROLL_MS) {
      settled.current = true;
      const values = diceRef.current.map((d) => {
        const q = new THREE.Quaternion(
          d.body.quaternion.x,
          d.body.quaternion.y,
          d.body.quaternion.z,
          d.body.quaternion.w,
        );
        return readUpFace(d.faces, q);
      });
      // Apply the same keep/sign/modifier math the notation specified, but on
      // the ACTUAL landed faces. We re-run the result's structure over them.
      const total = totalFromFaces(result, values);
      onSettled(total, values);
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#2a2a33', 0.9]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 10, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 6, -4]} intensity={0.7} />
      <pointLight position={[0, -3, 5]} intensity={0.5} color="#c2f04a" />
    </>
  );
}

// d6 gets a material per face with its number painted on.
function D6_MATERIALS(color: string): THREE.MeshStandardMaterial[] {
  // BoxGeometry face order: +x,-x,+y,-y,+z,-z -> values 3,4,1,6,2,5 (see D6_FACES)
  const order = [3, 4, 1, 6, 2, 5];
  return order.map(
    (n) =>
      new THREE.MeshStandardMaterial({
        map: numberTexture(n, color),
        metalness: 0.2,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
  );
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

// Recompute the roll total from the physically-landed per-die faces, honoring
// the notation's keep-highest/lowest and flat modifier.
function totalFromFaces(result: RollResult, faces: number[]): number {
  let total = 0;
  let cursor = 0;
  for (const term of result.dice) {
    const rolled = faces.slice(cursor, cursor + term.count);
    cursor += term.count;
    let kept = rolled;
    if (term.keep) {
      const sorted = [...rolled].sort((a, b) => (term.keep!.mode === 'h' ? b - a : a - b));
      kept = sorted.slice(0, term.keep.n);
    }
    total += term.sign * kept.reduce((s, x) => s + x, 0);
  }
  return total + result.modifier;
}

export function DiceOverlay() {
  const result = useStore((s) => s.diceOverlay);
  const clearDice = useStore((s) => s.clearDice);
  const recordLanded = useStore((s) => s.recordLanded);
  const [landed, setLanded] = useState<{ total: number; values: number[] } | null>(null);
  const [muted, setMuted] = useState(isDiceMuted());

  // reset when a new roll comes in
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
