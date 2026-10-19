import { useEffect, useState } from 'react';
import type { Phase, StartArgs } from '../../../../shared/types/battle';
import { FLIPPED_HOME_SPRITES } from '../../config/constants';
import { toID } from '../../utils/pokemon';

interface Props {
    phase: Phase,
}

const sample = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

async function post(name: string, args: StartArgs = {}) {
    const res = await fetch(`/api/command/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
    });
    return res.json() as Promise<{ ok: boolean, reason?: string }>;
}

/**
 * Dev-only matchup picker (open the overlay with ?dev in manual mode). Uses the same `start` command
 * Streamer.bot will use, via HTTP so it can show the server's rejection reason.
 */
export function DevPanel({ phase }: Props) {
    const [species, setSpecies] = useState<string[]>([]);
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Flip-list entries that can actually be battled (cosmetic formes aren't in the pool). Empty until /species loads.
    const pool = new Set(species.map(toID));
    const flipped = [...FLIPPED_HOME_SPRITES].filter(f => pool.has(toID(f)));

    useEffect(() => {
        fetch('/api/species').then(r => r.json()).then(setSpecies).catch(() => setSpecies([]));
    }, []);

    const start = async () => {
        setBusy(true);
        setError(null);
        try {
            // start() refuses mid-battle; reset first so the picker always works.
            if (phase !== 'idle') await post('reset');
            const result = await post('start', { p1Species: p1.trim() || undefined, p2Species: p2.trim() || undefined });
            if (!result.ok) setError(result.reason ?? 'start failed');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const input = 'w-full px-1 py-0.5 bg-black/60 border border-white/20 rounded text-white';
    const button = 'px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded disabled:opacity-40';

    return (
        <div className="fixed bottom-2 left-2 w-64 p-2 space-y-1 text-[11px] text-white bg-black/80 border border-yellow-400/50 rounded">
            <div className="font-bold text-yellow-400">Dev: pick matchup</div>
            <datalist id="pb-species">
                {species.map(s => <option key={s} value={s} />)}
            </datalist>
            <label className="block">P1 (back sprite, faces right)
                <input className={input} list="pb-species" value={p1} placeholder="random" onChange={e => setP1(e.target.value)} />
            </label>
            <label className="block">P2 (front sprite, faces left)
                <input className={input} list="pb-species" value={p2} placeholder="random" onChange={e => setP2(e.target.value)} />
            </label>
            <div className="flex gap-1 flex-wrap">
                <button className={button} disabled={!flipped.length} onClick={() => { setP1(sample(flipped)); setP2(sample(flipped)); }}>From flip list</button>
                <button className={button} onClick={() => { setP1(p2); setP2(p1); }}>Swap</button>
                <button className={button} onClick={() => { setP1(''); setP2(''); }}>Clear</button>
            </div>
            <button className={`${button} w-full bg-yellow-400/20`} onClick={start} disabled={busy}>
                {busy ? 'Starting…' : 'Start with these'}
            </button>
            {error && <div className="text-red-400">{error}</div>}
        </div>
    );
}
