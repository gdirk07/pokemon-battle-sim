import { useEffect, useState } from 'react';

export function useCountdown(deadline: number | null): number | null {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (deadline == null) return;
        const id = window.setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(id);
    }, [deadline]);

    if (deadline == null) return null;
    return Math.max(0, Math.ceil((deadline - now) / 1000));
}

// true once `active` has been continuously true for `ms`
export function useDelayedFlag(active: boolean, ms: number): boolean {
    const [elapsed, setElapsed] = useState(false);

    useEffect(() => {
        if (!active) return;
        const id = window.setTimeout(() => setElapsed(true), ms);
        return () => { clearTimeout(id); setElapsed(false); };
    }, [active, ms]);

    return active && elapsed;
}
