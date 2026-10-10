import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

// BattleSession is CommonJS and loads Showdown with require(). vi.mock() only intercepts ES imports,
// so it never replaced the real simulator here. Plant the fake in Node's require cache instead,
// BEFORE BattleSession (and team-builder) are first loaded.
const nodeRequire = createRequire(import.meta.url);

const showdown = {
    // Regular functions (not arrows) so they work with `new` under vitest 4.
    BattleStream: vi.fn(function () {
        return {
            write: vi.fn(),
            // No events by default: the battle never progresses on its own.
            [Symbol.asyncIterator]: async function* () {},
        };
    }),
    Teams: {
        pack: vi.fn().mockReturnValue('mock-team'),
        unpack: vi.fn().mockReturnValue([{ name: 'Pikachu', item: 'light-ball' }]),
        generate: vi.fn().mockReturnValue([{ name: 'Pikachu', item: 'light-ball' }]),
    },
};

const showdownPath = nodeRequire.resolve('pokemon-showdown');
nodeRequire.cache[showdownPath] = {
    id: showdownPath, filename: showdownPath, loaded: true, children: [], paths: [], exports: showdown,
};

const { default: BattleSession } = await import('../BattleSession');

const flush = (session, turns = 2) => {
    // Two |turn| events: the first arms pendingTurn, the second flushes the buffered log into state.
    for (let i = 1; i <= turns; i++) session.handleEvent({ type: 'turn', data: [String(i)], raw: `|turn|${i}|` });
};

describe('BattleSession', () => {
    beforeEach(() => {
        // handleEvent logs every event and handleRequest logs failures; keep test output readable.
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();   // undo spies (console, Math.random, timers)
        vi.clearAllMocks();     // reset call history on the Showdown fakes
    });

    describe('Constructor', () => {
        it('initializes with correct id', () => {
            const session = new BattleSession('test-123');
            expect(session.id).toBe('test-123');
        });

        it('initializes with ended = false', () => {
            const session = new BattleSession('test-123');
            expect(session.ended).toBe(false);
        });

        it('initializes state with correct defaults', () => {
            const session = new BattleSession('test-123');
            expect(session.state.turn).toBe(0);
            expect(session.state.winner).toBeNull();
            expect(session.state.log).toHaveLength(0);
            expect(session.state.player1).toBeNull();
            expect(session.state.player2).toBeNull();
        });

        it('initializes validMoves for both players', () => {
            const session = new BattleSession('test-123');
            expect(session.validMoves.p1).toEqual([1, 2, 3, 4]);
            expect(session.validMoves.p2).toEqual([1, 2, 3, 4]);
        });

        it('uses the (mocked) Showdown BattleStream', () => {
            const session = new BattleSession('test-123');
            expect(showdown.BattleStream).toHaveBeenCalledTimes(1);
            expect(session.stream.write).toBeTypeOf('function');
        });
    });

    describe('startBattle', () => {
        it('creates random teams for both players', async () => {
            const session = new BattleSession('test-start');
            session.listen = vi.fn();
            const [p1, p2] = await session.startBattle();

            expect(Array.isArray(p1)).toBe(true);
            expect(Array.isArray(p2)).toBe(true);
            expect(p1.length).toBe(1);
            expect(p2.length).toBe(1);
        });

        it('sends start and player setup commands', async () => {
            const session = new BattleSession('test-start');
            session.listen = vi.fn();
            await session.startBattle();

            const write = session.stream.write;
            expect(write).toHaveBeenCalledWith('>start {"formatid":"gen9customgame"}');
            expect(write).toHaveBeenCalledWith('>player p1 {"name":"Challenger 1", "team":"mock-team"}');
            expect(write).toHaveBeenCalledWith('>player p2 {"name":"Challenger 2", "team":"mock-team"}');
        });

        it('sets display item from unpacked team', async () => {
            const session = new BattleSession('test-start');
            session.listen = vi.fn();
            await session.startBattle();

            expect(session.state.p1DisplayItem).toBe('light-ball');
            expect(session.state.p2DisplayItem).toBe('light-ball');
        });

        it('calls listen after starting battle', async () => {
            const session = new BattleSession('test-start');
            session.listen = vi.fn();
            await session.startBattle();
            expect(session.listen).toHaveBeenCalledTimes(1);
        });
    });

    describe('beginBattle', () => {
        it('sends team reveal commands', () => {
            const session = new BattleSession('test-begin');
            session.beginBattle();

            expect(session.stream.write).toHaveBeenCalledWith('>p1 team 1');
            expect(session.stream.write).toHaveBeenCalledWith('>p2 team 1');
        });
    });

    describe('nextTurn', () => {
        it('makes random move selection for both players', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0);   // first valid move, deterministically
            const session = new BattleSession('test-next');
            session.nextTurn();

            expect(session.stream.write).toHaveBeenCalledWith('>p1 move 1');
            expect(session.stream.write).toHaveBeenCalledWith('>p2 move 1');
        });

        it('only picks from the valid moves for each side', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            const session = new BattleSession('test-next-valid');
            session.validMoves = { p1: [2], p2: [3, 4] };
            session.nextTurn();

            expect(session.stream.write).toHaveBeenCalledWith('>p1 move 2');
            expect(session.stream.write).toHaveBeenCalledWith('>p2 move 4');
        });

        it('resets turnLog and turnLogBuffer', () => {
            const session = new BattleSession('test-next');
            session.state.turnLog = ['old-log'];
            session.turnLogBuffer = ['old-buffer'];

            session.nextTurn();

            expect(session.state.turnLog).toHaveLength(0);
            expect(session.turnLogBuffer).toHaveLength(0);
        });
    });

    describe('getState', () => {
        it('returns state with correct structure', () => {
            const session = new BattleSession('test-state');
            const state = session.getState();

            expect(state.id).toBe('test-state');
            expect(state.status).toBe('active');
            expect(state.turn).toBe(0);
            expect(state.turnLog).toEqual([]);
        });

        it('returns ended status when battle is over', () => {
            const session = new BattleSession('test-ended');
            session.ended = true;
            const state = session.getState();

            expect(state.status).toBe('ended');
        });

        it('includes winner in state', () => {
            const session = new BattleSession('test-winner');
            session.state.winner = 'player1';
            const state = session.getState();

            expect(state.winner).toBe('player1');
        });

        it('parses turnLog using parseTurnLog', () => {
            const session = new BattleSession('test-logs');
            const turnLogParser = nodeRequire('../turnLogParser');
            const original = turnLogParser.parseTurnLog;
            turnLogParser.parseTurnLog = vi.fn().mockReturnValue([{ text: 'Charizard used Flamethrower!' }]);

            try {
                session.state.turnLog = [{ raw: '|move|p1a: Charizard|Flamethrower|' }];
                const state = session.getState();

                expect(state.turnLog).toHaveLength(1);
                expect(state.turnLog[0].text).toBe('Charizard used Flamethrower!');
            } finally {
                turnLogParser.parseTurnLog = original;
            }
        });
    });

    describe('waitForTurn', () => {
        beforeEach(() => { vi.useFakeTimers(); });

        it('resolves when turn is flushed', async () => {
            const session = new BattleSession('test-wait');
            session.state.turn = 0;

            let resolved = false;
            const promise = session.waitForTurn(15000).then(() => { resolved = true; });

            await vi.advanceTimersByTimeAsync(100);
            expect(resolved).toBe(false);               // turn has not advanced yet

            session.state.turn = 1;
            await vi.advanceTimersByTimeAsync(50);
            await promise;
            expect(resolved).toBe(true);
        });

        it('rejects with timeout error when turn does not advance', async () => {
            const session = new BattleSession('test-timeout');
            session.state.turn = 0;

            const assertion = expect(session.waitForTurn(100)).rejects.toThrow('Turn timeout');
            await vi.advanceTimersByTimeAsync(100);
            await assertion;
        });

        it('resolves when battle ends with turn log', async () => {
            const session = new BattleSession('test-ended-wait');
            session.ended = true;
            session.state.turnLog = ['log-entry'];

            const promise = session.waitForTurn(1000);
            await vi.advanceTimersByTimeAsync(50);
            await expect(promise).resolves.toBeUndefined();
        });

        it('does not resolve on an ended battle with an empty turn log', async () => {
            const session = new BattleSession('test-ended-empty');
            session.ended = true;
            session.state.turnLog = [];

            const assertion = expect(session.waitForTurn(200)).rejects.toThrow('Turn timeout');
            await vi.advanceTimersByTimeAsync(200);
            await assertion;
        });
    });

    describe('handleEvent', () => {
        it('records the raw event in state.log', () => {
            const session = new BattleSession('test-log-raw');
            session.handleEvent({ type: 'move', data: ['Flamethrower'], raw: '|move|p1a: Charizard|Flamethrower|' });
            expect(session.state.log).toEqual(['|move|p1a: Charizard|Flamethrower|']);
        });

        it('arms pendingTurn on the first turn event without advancing state.turn', () => {
            const session = new BattleSession('test-turn');
            session.handleEvent({ type: 'turn', data: ['1'], raw: '|turn|1|' });
            expect(session.pendingTurn).toBe(1);
            expect(session.state.turn).toBe(0);
        });

        it('flushes the buffered log and advances state.turn on the next turn event', () => {
            const session = new BattleSession('test-turn-flush');
            session.handleEvent({ type: 'turn', data: ['1'], raw: '|turn|1|' });
            session.handleEvent({ type: 'move', data: ['Tackle'], raw: '|move|p1a: Pikachu|Tackle|' });
            session.handleEvent({ type: 'turn', data: ['2'], raw: '|turn|2|' });

            expect(session.state.turn).toBe(1);          // turn 1 has been fully played
            expect(session.pendingTurn).toBe(2);
            expect(session.state.turnLog).toHaveLength(1);
            expect(session.state.turnLog[0].raw).toBe('|move|p1a: Pikachu|Tackle|');
            expect(session.turnLogBuffer).toHaveLength(0);
        });

        it('records damage as an hp delta on the buffered entry', () => {
            const session = new BattleSession('test-damage');
            session.handleEvent({ type: '-damage', data: ['p1a: Pikachu', '100/150'], raw: '|-damage|p1a: Pikachu|100/150|' });

            expect(session.turnLogBuffer).toHaveLength(1);
            expect(session.turnLogBuffer[0].hp).toEqual({ side: 'p1', hp: 100, maxHp: 150 });
            expect(session.turnLogBuffer[0].status).toBeNull();
        });

        it('captures a status suffix on a damage condition', () => {
            const session = new BattleSession('test-damage-status');
            session.handleEvent({ type: '-damage', data: ['p2a: Gengar', '50/100 brn'], raw: '|-damage|p2a: Gengar|50/100 brn|[from] brn' });

            expect(session.turnLogBuffer[0].hp).toEqual({ side: 'p2', hp: 50, maxHp: 100 });
            expect(session.turnLogBuffer[0].status).toEqual({ side: 'p2', value: 'brn' });
        });

        it('updates the condition of an existing player on damage', () => {
            const session = new BattleSession('test-damage-cond');
            session.state.player1 = { name: 'Pikachu', condition: '150/150' };
            session.handleEvent({ type: '-damage', data: ['p1a: Pikachu', '100/150'], raw: '|-damage|p1a: Pikachu|100/150|' });

            expect(session.state.player1.condition).toBe('100/150');
            expect(session.state.player1.name).toBe('Pikachu');
        });

        it('does not create a player from a damage event', () => {
            const session = new BattleSession('test-damage-null');
            session.handleEvent({ type: '-damage', data: ['p1a: Pikachu', '100/150'], raw: '|-damage|p1a: Pikachu|100/150|' });
            expect(session.state.player1).toBeNull();
        });

        it('processes faint event', () => {
            const session = new BattleSession('test-faint');
            session.state.player2 = { name: 'Gengar', condition: '10/100' };
            session.handleEvent({ type: 'faint', data: ['p2a: Gengar'], raw: '|faint|p2a: Gengar|' });

            expect(session.state.player2.condition).toBe('0 fnt');
            expect(session.turnLogBuffer[0].hp).toEqual({ side: 'p2', hp: 0, maxHp: null });
        });

        it('processes substitute start and end events', () => {
            const session = new BattleSession('test-substitute');
            session.handleEvent({ type: '-start', data: ['p1a: Pikachu', 'Substitute'], raw: '|-start|p1a: Pikachu|Substitute|' });
            session.handleEvent({ type: '-end', data: ['p1a: Pikachu', 'Substitute'], raw: '|-end|p1a: Pikachu|Substitute|' });

            expect(session.turnLogBuffer[0].substitute).toEqual({ side: 'p1', active: true });
            expect(session.turnLogBuffer[1].substitute).toEqual({ side: 'p1', active: false });
        });

        it('ignores -start events for effects other than Substitute', () => {
            const session = new BattleSession('test-start-other');
            session.handleEvent({ type: '-start', data: ['p1a: Pikachu', 'confusion'], raw: '|-start|p1a: Pikachu|confusion|' });
            expect(session.turnLogBuffer[0].substitute).toBeNull();
        });

        it('processes status event', () => {
            const session = new BattleSession('test-status');
            session.handleEvent({ type: '-status', data: ['p1a: Charizard', 'brn'], raw: '|-status|p1a: Charizard|brn|' });
            expect(session.turnLogBuffer[0].status).toEqual({ side: 'p1', value: 'brn' });
        });

        it('processes curestatus event', () => {
            const session = new BattleSession('test-cure');
            session.handleEvent({ type: '-curestatus', data: ['p1a: Charizard'], raw: '|-curestatus|p1a: Charizard|' });
            expect(session.turnLogBuffer[0].status).toEqual({ side: 'p1', value: null });
        });

        it('adds event to turnLogBuffer', () => {
            const session = new BattleSession('test-buffer');
            session.handleEvent({ type: 'move', data: ['Flamethrower'], raw: '|move|p1a: Charizard|Flamethrower|' });
            expect(session.turnLogBuffer).toHaveLength(1);
            expect(session.turnLogBuffer[0].raw).toBe('|move|p1a: Charizard|Flamethrower|');
        });

        it('flushes turnLogBuffer on win event', () => {
            const session = new BattleSession('test-win');
            flush(session, 1);                               // pendingTurn = 1
            session.handleEvent({ type: 'move', data: ['Tackle'], raw: '|move|p1a: Pikachu|Tackle|' });

            session.handleEvent({ type: 'win', data: ['Challenger 1'], raw: '|win|Challenger 1|' });

            expect(session.state.turn).toBe(1);              // pending turn is committed
            expect(session.pendingTurn).toBeNull();
            expect(session.turnLogBuffer).toHaveLength(0);
            expect(session.state.turnLog.map(e => e.raw)).toEqual(['|move|p1a: Pikachu|Tackle|', '|win|Challenger 1|']);
            expect(session.ended).toBe(true);
        });

        it('logs event to console with the session id', () => {
            const session = new BattleSession('test-log');
            session.handleEvent({ type: 'test', data: ['data'], raw: '|test|' });
            expect(console.log).toHaveBeenCalledWith('[test-log]', 'test', ['data']);
        });
    });

    describe('handleRequest', () => {
        it('updates player1 from teamPreview request', () => {
            const session = new BattleSession('test-request');
            session.handleRequest({
                type: 'request',
                data: ['{"teamPreview":true,"side":{"id":"p1","pokemon":[{"name":"Pikachu","active":true}]}}'],
                raw: '|request|{"teamPreview":true,...}',
            });
            expect(session.state.player1).toBeDefined();
            expect(session.state.player1.name).toBe('Pikachu');
        });

        it('updates player2 from teamPreview request', () => {
            const session = new BattleSession('test-request-p2');
            session.handleRequest({
                type: 'request',
                data: ['{"teamPreview":true,"side":{"id":"p2","pokemon":[{"name":"Gengar","active":true}]}}'],
                raw: '|request|{"teamPreview":true,...}',
            });
            expect(session.state.player2).toBeDefined();
            expect(session.state.player2.name).toBe('Gengar');
        });

        it('updates active player from request', () => {
            const session = new BattleSession('test-active');
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p1","pokemon":[{"name":"Bulbasaur"},{"name":"Pikachu","active":true}]}}'],
                raw: '|request|{...}',
            });
            expect(session.state.player1.name).toBe('Pikachu');       // picks the active one, not the first
        });

        it('shows the team-builder item instead of the request item', () => {
            const session = new BattleSession('test-item');
            session.state.p1DisplayItem = 'light-ball';
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p1","pokemon":[{"name":"Pikachu","active":true,"item":"leftovers"}]}}'],
                raw: '|request|{...}',
            });
            expect(session.state.player1.item).toBe('light-ball');
        });

        it('updates validMoves for p1', () => {
            const session = new BattleSession('test-valid');
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p1","pokemon":[{"name":"Pikachu","active":true}]},"active":[{"moves":[{"name":"Tackle","disabled":false,"pp":20}]}]}'],
                raw: '|request|{...}',
            });
            expect(session.validMoves.p1).toEqual([1]);
            expect(session.validMoves.p2).toEqual([1, 2, 3, 4]);       // other side untouched
        });

        it('updates validMoves for p2', () => {
            const session = new BattleSession('test-valid-p2');
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p2","pokemon":[{"name":"Gengar","active":true}]},"active":[{"moves":[{"name":"ShadowBall","disabled":false,"pp":20}]}]}'],
                raw: '|request|{...}',
            });
            expect(session.validMoves.p2).toEqual([1]);
            expect(session.validMoves.p1).toEqual([1, 2, 3, 4]);
        });

        it('filters disabled moves from validMoves', () => {
            const session = new BattleSession('test-filter');
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p1","pokemon":[{"name":"Pikachu","active":true}]},"active":[{"moves":[{"name":"Tackle","disabled":true,"pp":20},{"name":"Thunder","disabled":false,"pp":10}]}]}'],
                raw: '|request|{...}',
            });
            expect(session.validMoves.p1).toEqual([2]);
        });

        it('filters moves with no PP left', () => {
            const session = new BattleSession('test-pp');
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p1","pokemon":[{"name":"Pikachu","active":true}]},"active":[{"moves":[{"name":"Tackle","disabled":false,"pp":0},{"name":"Thunder","disabled":false,"pp":5}]}]}'],
                raw: '|request|{...}',
            });
            expect(session.validMoves.p1).toEqual([2]);
        });

        it('falls back to move 1 (Struggle) when no move is usable', () => {
            const session = new BattleSession('test-struggle');
            session.handleRequest({
                type: 'request',
                data: ['{"side":{"id":"p1","pokemon":[{"name":"Pikachu","active":true}]},"active":[{"moves":[{"name":"Tackle","disabled":true,"pp":0}]}]}'],
                raw: '|request|{...}',
            });
            expect(session.validMoves.p1).toEqual([1]);
        });

        it('handles invalid JSON gracefully', () => {
            const session = new BattleSession('test-invalid');
            expect(() => session.handleRequest({ type: 'request', data: ['invalid-json'], raw: '|request|invalid' })).not.toThrow();
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('handleWin', () => {
        it('sets winner based on challenger name', () => {
            const session = new BattleSession('test-win-p1');
            session.handleWin({ type: 'win', data: ['Challenger 1'] });
            expect(session.state.winner).toBe('player1');
            expect(session.ended).toBe(true);
        });

        it('sets winner to player2 when Challenger 2 wins', () => {
            const session = new BattleSession('test-win-p2');
            session.handleWin({ type: 'win', data: ['Challenger 2'] });
            expect(session.state.winner).toBe('player2');
            expect(session.ended).toBe(true);
        });

        it('adds turn entry to buffer on win', () => {
            const session = new BattleSession('test-win-buffer');
            session.turnLogBuffer = ['buffer-entry'];
            // handleEvent does the buffer flush for win events, including the win entry itself
            session.handleEvent({ type: 'win', data: ['Challenger 1'], raw: '|win|Challenger 1|' });

            expect(session.state.turnLog).toHaveLength(2);
            expect(session.state.turnLog[0]).toBe('buffer-entry');
            expect(session.state.turnLog[1].raw).toBe('|win|Challenger 1|');
        });
    });

    describe('skipNext logic in listen', () => {
        const runListen = async (session, lines) => {
            const chunk = lines.join('\n');
            session.stream = { [Symbol.asyncIterator]: async function* () { yield chunk; } };
            session.listen();                                  // fire-and-forget by design
            await vi.waitFor(() => expect(session.pendingTurn).not.toBeNull());
        };

        it('skips move, switch, drag, detailschange, replace, -damage, -heal events after split', async () => {
            const session = new BattleSession('test-skip');
            await runListen(session, [
                '|split|p1',
                '|move|p1a: Pikachu|Tackle|p2a: Gengar',      // secret duplicate: skipped
                '|turn|1',
            ]);

            expect(session.state.log).toEqual(['|turn|1']);
            expect(session.pendingTurn).toBe(1);
        });

        it.each(['switch', 'drag', 'detailschange', 'replace', '-damage', '-heal'])(
            'skips a %s event that follows a split',
            async (type) => {
                const session = new BattleSession(`test-skip-${type}`);
                await runListen(session, ['|split|p1', `|${type}|p1a: Pikachu|x`, '|turn|1']);
                expect(session.state.log).toEqual(['|turn|1']);
            });

        it('only skips the single event immediately after a split', async () => {
            const session = new BattleSession('test-skip-one');
            await runListen(session, [
                '|split|p1',
                '|move|p1a: Pikachu|Tackle|p2a: Gengar',      // skipped
                '|move|p2a: Gengar|Shadow Ball|p1a: Pikachu', // handled
                '|turn|1',
            ]);

            expect(session.state.log).toEqual(['|move|p2a: Gengar|Shadow Ball|p1a: Pikachu', '|turn|1']);
        });

        it('does not skip event types outside the skip list', async () => {
            const session = new BattleSession('test-skip-other');
            await runListen(session, ['|split|p1', '|-status|p1a: Pikachu|brn', '|turn|1']);
            expect(session.state.log).toEqual(['|-status|p1a: Pikachu|brn', '|turn|1']);
        });
    });
});
