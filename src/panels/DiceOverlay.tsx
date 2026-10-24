import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import { diceToRender, type RollResult } from '../lib/dice';
import type { Mesh } from 'three';

// A single tumbling die. Geometry roughly keyed to die type.
function Die({
  position,
  value,
  sides,
  seed,
}: {
  position: [number, number, number];
  value: number;
  sides: number;
  seed: number;
}) {
  const ref = useRef<Mesh>(null);
  const settleAt = 0.9 + (seed % 5) * 0.08;
  const start = useRef(performance.now());

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = (performance.now() - start.current) / 1000;
    if (t < settleAt) {
      // tumble fast then ease out
      const speed = Math.max(0, 1 - t / settleAt);
      mesh.rotation.x += 0.25 * speed + 0.02;
      mesh.rotation.y += 0.3 * speed + 0.02;
      mesh.rotation.z += 0.15 * speed;
      mesh.position.y = position[1] + Math.sin(t * 8) * speed * 1.5;
    } else {
      // settle to a gentle resting wobble
      mesh.rotation.x += (Math.round(mesh.rotation.x / 1.57) * 1.57 - mesh.rotation.x) * 0.15;
      mesh.rotation.z += (Math.round(mesh.rotation.z / 1.57) * 1.57 - mesh.rotation.z) * 0.15;
      mesh.position.y += (position[1] - mesh.position.y) * 0.15;
    }
  });

  // d20/d12/d8/d10 -> icosahedron-ish; d6 -> box; d4 -> tetra.
  const geom = useMemo(() => {
    if (sides === 6) return <boxGeometry args={[1, 1, 1]} />;
    if (sides === 4) return <tetrahedronGeometry args={[0.8]} />;
    if (sides === 8) return <octahedronGeometry args={[0.75]} />;
    if (sides === 12) return <dodecahedronGeometry args={[0.7]} />;
    return <icosahedronGeometry args={[0.75]} />; // d20, d10, d100
  }, [sides]);

  const crit = sides === 20 && value === 20;
  const fumble = sides === 20 && value === 1;
  const color = crit ? '#c2f04a' : fumble ? '#ff6b7a' : '#c86bff';
  const emissive = crit ? '#c2f04a' : fumble ? '#ff6b7a' : '#7a2eb0';

  return (
    <mesh ref={ref} position={position}>
      {geom}
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.35}
        metalness={0.3}
        roughness={0.25}
        flatShading
      />
    </mesh>
  );
}

function DiceScene({ result }: { result: RollResult }) {
  const dice = useMemo(() => diceToRender(result), [result]);
  // Lay dice out in a loose grid centered on origin.
  const cols = Math.ceil(Math.sqrt(dice.length));
  const spacing = 2.2;
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <pointLight position={[-5, 2, 3]} intensity={0.5} color="#c86bff" />
      {dice.map((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * spacing;
        const y = ((Math.ceil(dice.length / cols) - 1) / 2 - row) * spacing;
        return (
          <Die
            key={i}
            position={[x, y, 0]}
            value={d.value}
            sides={d.sides}
            seed={i + d.value}
          />
        );
      })}
    </>
  );
}

export function DiceOverlay() {
  const result = useStore((s) => s.diceOverlay);
  const clearDice = useStore((s) => s.clearDice);
  if (!result) return null;

  const breakdown = result.dice
    .map((d) => `${d.count}d${d.sides} [${d.results.join(', ')}]`)
    .join('  +  ');

  return (
    <div className="dice-overlay" onClick={clearDice} role="button" aria-label="Dismiss roll">
      <div className="dice-canvas">
        <Canvas camera={{ position: [0, 0, 11], fov: 50 }} dpr={[1, 2]}>
          <DiceScene result={result} />
        </Canvas>
      </div>
      <div className="notation-readout">{result.notation.toUpperCase()}</div>
      <div className="total-readout">{result.total}</div>
      <div className="breakdown">
        {breakdown}
        {result.modifier ? `  ${result.modifier >= 0 ? '+' : ''}${result.modifier}` : ''}
      </div>
      <div className="dismiss-hint">click anywhere to dismiss</div>
    </div>
  );
}
