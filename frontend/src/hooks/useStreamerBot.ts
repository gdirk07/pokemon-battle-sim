import { useCallback, useEffect, useRef } from 'react';

interface StreamerBotMessage {
    event: {
        source: string,
        type: string,
    }
    data: {
        data:{
            action?: { name: string };
            p1Total?: number;
            p2Total?: number;
        }
    }
}

interface Props {
    onStartBattle: () => void,
    onNextTurn: () => void,
    onBet?: (p1Total: number | undefined, p2Total: number | undefined) => void,
    enabled: boolean,
}

export function useStreamerBot({ onStartBattle, onNextTurn, onBet, enabled }: Props) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const send = useCallback((actionName: string, data?: Record<string, unknown>)=> {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            request: 'DoAction',
            action: {
                name: actionName,
            },
            args: data ?? {},
            id: crypto.randomUUID()
        }));
    }, []);

    useEffect(() => {
        if (!enabled) return;

        function connect() {
            // streamer.bot WebSocket server default port
            const ws = new WebSocket('ws://localhost:9000');
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Connected to streamer.bot');

                // Subscribe to action events
                ws.send(JSON.stringify({
                    request: 'Subscribe',
                    events: {
                        'General': ['Custom'],
                    },
                    id: 'pb-subscribe',
                }))
            }

            ws.onmessage = (event) => {
                try {
                    const msg: StreamerBotMessage = JSON.parse(event.data);

                    // streamer.bot fires a Custom event with the action name
                    if (msg.event?.type === 'Custom') {
                        const action = msg.data?.data?.action?.name;
                        console.log('streamer.bot action:', action);

                        switch (action) {
                            case 'PB_START_BATTLE':
                                onStartBattle();
                                break;
                            case 'PB_NEXT_TURN':
                                onNextTurn();
                                break;
                            case 'PB_BET_UPDATE': {
                                const { p1Total, p2Total } = msg.data?.data;
                                onBet?.(p1Total, p2Total);
                                break;
                            }
                        }
                    }
                } catch (err) {
                    console.error('streamer.bot message parse error:', err);
                }
            }

            ws.onclose = () => {
                console.log('streamer.bot disconnected, retrying in 5s...');
                reconnectRef.current = setTimeout(connect, 5000);
            }

            ws.onerror = (err) => {
                console.error('streamer.bot WS error:', err);
            }
        }

        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
        }
    }, [enabled]);

    return { send };
}