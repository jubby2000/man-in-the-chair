import { useRef, useState } from 'react';
import { useDiceSetStore, DICE_SETS } from '../theme/diceSets';
import { useStore } from '../store/useStore';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB cap for a dice texture

export function DiceSetPicker() {
  const setId = useDiceSetStore((s) => s.setId);
  const customSets = useDiceSetStore((s) => s.customSets);
  const setDiceSet = useDiceSetStore((s) => s.setDiceSet);
  const addCustomSet = useDiceSetStore((s) => s.addCustomSet);
  const removeCustomSet = useDiceSetStore((s) => s.removeCustomSet);
  const showToast = useStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const current = useDiceSetStore((s) => s.current());
  const isCustom = customSets.some((c) => c.id === setId);

  const onChange = (value: string) => {
    if (value === '__upload__') {
      fileRef.current?.click();
      return;
    }
    setDiceSet(value);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showToast('Image too large (max 4 MB).');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const name = file.name.replace(/\.[^.]+$/, '');
      await addCustomSet(name, dataUrl);
      showToast(`Custom dice set “${name}” added`);
    } catch {
      showToast('Could not read that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Dice set">
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: current.textureDataUrl
            ? `center/cover url(${current.textureDataUrl})`
            : current.perType?.[20] ?? current.body,
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}
      />
      <select className="select" value={setId} onChange={(e) => onChange(e.target.value)} disabled={busy}>
        <optgroup label="Built-in">
          {DICE_SETS.map((d) => (
            <option key={d.id} value={d.id}>
              🎲 {d.name}
            </option>
          ))}
        </optgroup>
        {customSets.length > 0 && (
          <optgroup label="Custom">
            {customSets.map((d) => (
              <option key={d.id} value={d.id}>
                🖼 {d.name}
              </option>
            ))}
          </optgroup>
        )}
        <option value="__upload__">＋ Upload image…</option>
      </select>
      {isCustom && (
        <button className="btn icon sm" title="Remove this custom set" onClick={() => removeCustomSet(setId)}>
          ✕
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
