import { useEffect, useRef } from 'react';
import { useBattleStore } from '../store/battleStore';
import type { BattleEvent } from '../../../shared/types/battle';

export function useBattleSocket() {
    const socketRef = useRef<WebSocket | null>(null);
    const { setBattle, setConnected } = useBattleStore();

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3000/ws');
        socketRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            console.log('Connected to battle server');
        }

        ws.onmessage = (event) => {
            const data: BattleEvent = JSON.parse(event.data);

            switch (data.type) {
                case 'BATTLE_START':
                case 'TURN_UPDATE':
                    setBattle(data.battle);
                    break;
                case 'BATTLE_END':
                    setBattle(data.battle);
                    break;
            }
        }

        ws.onclose = () => {
            setConnected(false);
            console.log('Disconnected from battle server');
        }

        ws.onerror = (err) => {
            console.error('WebSocket error:', err);
            setConnected(false);
        }

        return () => ws.close()
    }, []);
}