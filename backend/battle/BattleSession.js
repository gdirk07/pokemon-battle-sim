const { BattleStream } = require('pokemon-showdown');
const { parseOutput } = require('./parser');
const { parseTurnLog } = require('./turnLogParser');
const { buildRandomSet } = require('./team-builder');
const { Teams } = require('pokemon-showdown');

class BattleSession {
    constructor(id) {
        this.id = id;
        this.ended = false;
        this.initStream();
    }

    initStream() {
        this.stream = new BattleStream();

        this.state = {
            turn: 0,
            log: [],
            turnLog: [],
            winner: null,
            player1: null,
            player2: null,
        };
        this.turnLogBuffer = [];
        this.validMoves = { p1: [1, 2, 3, 4], p2: [1, 2, 3, 4] };
        this.pendingTurn = null;
    }

    async startBattle() {
        const p1Team = await buildRandomSet("p1");
        const p2Team = await buildRandomSet("p2");
        
        this.stream.write(`>start {"formatid":"gen9customgame"}`);
        this.stream.write(
            `>player p1 {"name":"Challenger 1", "team":"${p1Team}"}`);
        this.stream.write(
            `>player p2 {"name":"Challenger 2", "team":"${p2Team}"}`);
        this.stream.write(`>p1 team 1`);
        this.stream.write(`>p2 team 1`);
        this.listen();
        
        return [Teams.unpack(p1Team), Teams.unpack(p2Team)];

    }
    listen() {
        (async () => {
            for await (const chunk of this.stream) {
                const events = parseOutput(chunk);
                let skipNext = false;
                for (const event of events) {
                    if (event.type === 'split') {
                        skipNext = true;
                        continue;
                    }

                    if (skipNext) {
                        skipNext = false;
                        const skipTypes = ['move', 'switch', 'drag', 'detailschange', 'replace', '-damage', '-heal'];
                        if (skipTypes.includes(event.type)) continue;
                    }
                    this.handleEvent(event);
                }
            }
        })();
    }

    handleEvent(event) {
        this.state.log.push(event.raw);
        const entry = { raw: event.raw, hp: null };

        switch (event.type) {
            case 'turn':
                const newTurn = parseInt(event.data[0]);
                if (this.pendingTurn !== null) {
                    this.state.turnLog = [...this.turnLogBuffer];
                    this.turnLogBuffer = [];
                    this.state.turn = this.pendingTurn;
                }

                this.pendingTurn = newTurn;
                break;
            case '-heal':
            case '-damage': 
                const ident = event.data[0];
                const condition = event.data[1];
                const isFaint = condition === '0 fnt' || condition === '0';
                const hpPart = isFaint ? '0 fnt' : condition?.split(' ')[0] ?? condition;
                const [hp, maxHp] = isFaint ?
                    [0, null] :
                    hpPart.split('/').map(Number);
                const side = ident?.startsWith('p1') ? 'p1' : 'p2';
                const key = side === 'p1' ? 'player1' : 'player2';

                entry.hp = {
                    side,
                    hp,
                    maxHp: isNaN(maxHp) ? null : maxHp
                };

                const status = isFaint ? 'fnt' : condition?.split(' ')[1];
                if (status) {
                    entry.status = { side, value: status === 'fnt' ? 'fnt' : status };
                }

                if (this.state[key]) {
                    this.state[key] = { ...this.state[key], condition: isFaint ? '0 fnt' : condition };
                }
                break;

            case '-status': {
                const ident = event.data[0];
                const status = event.data[1];
                const side = ident?.startsWith('p1') ? 'p1' : 'p2';

                entry.status = { side, value: status };
                break;
            }

            case '-curestatus': {
                const ident = event.data[0];
                const side  = ident?.startsWith('p1') ? 'p1' : 'p2';
                entry.status = { side, value: null };
                break;
            }

            case 'faint': {
                const ident = event.data[0];
                const side = ident?.startsWith('p1') ? 'p1' : 'p2';
                const key = side === 'p1' ? 'player1' : 'player2';

                entry.hp = { side, hp: 0, maxHp: null };

                if (this.state[key]) {
                    this.state[key] = { ...this.state[key], condition: '0 fnt' };
                }
                break;
            }
            case 'request':
                this.handleRequest(event);
                break;

            case 'win':
                this.turnLogBuffer.push(entry);
                this.state.turnLog = [...this.turnLogBuffer];
                this.turnLogBuffer  = [];
                if (this.pendingTurn !== null) {
                    this.state.turn = this.pendingTurn;
                    this.pendingTurn = null;
                }
                this.handleWin(event);
                break;

        }
        if (event.type !== 'turn' && event.type !== 'win') {
            this.turnLogBuffer.push(entry);
        }
        console.log(`[${this.id}]`, event.type, event.data);        
    }

    handleRequest(event) {
        try {
            const request = JSON.parse(event.data[0]);
            if (request?.teamPreview) {
                request.side.id === 'p1' ?
                    this.state.player1 = request.side.pokemon[0] :
                    this.state.player2 = request.side.pokemon[0];
            }
            
            if (request?.side?.pokemon) {
                const activePokemon = request.side.pokemon.find(p => p.active) 
                                ?? request.side.pokemon[0];

                request.side.id === 'p1'
                    ? this.state.player1 = activePokemon
                    : this.state.player2 = activePokemon;
            }

            if (request.active?.[0]?.moves) {
                const validMoves = request.active[0].moves
                    .map((move, index) => ({ ...move, index: index + 1 }))
                    .filter(move => !move.disabled && move.pp >0)
                    .map(move => move.index);
                
                const available = validMoves.length > 0 ? validMoves : [1];
                request.side.id === 'p1'
                    ? this.validMoves.p1 = available
                    : this.validMoves.p2 = available
            }    
        } catch (err) {
            console.error('Failed to handle request:', err);
        }
    }

    handleWin(event) {
        const winner = event.data[0];
        this.state.winner = winner === 'Challenger 1' ? 'player1' : 'player2';
        console.log(`[${this.id}] Winner: ${winner} → ${this.state.winner}`)
        this.ended = true;
    }

    nextTurn() {
        this.state.turnLog = [];
        this.turnLogBuffer = [];

        const p1Moves = this.validMoves.p1;
        const p2Moves = this.validMoves.p2;

        const move1 = p1Moves[Math.floor(Math.random() * p1Moves.length)];
        const move2 = p2Moves[Math.floor(Math.random() * p2Moves.length)];

        this.stream.write(`>p1 move ${move1}`);
        this.stream.write(`>p2 move ${move2}`);
    }

    getState() {
        return {
            ...this.state,
            id: this.id,
            status: this.ended ? 'ended' : 'active',
            winner: this.state.winner,
            turnLog: parseTurnLog(this.state.turnLog),
        };
    }

    waitForTurn(timeout = 5000) {
        const targetTurn = this.state.turn + 1;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Turn timeout')), timeout);

            const check = setInterval(() => {

                const turnFlushed = this.state.turn >= targetTurn;
                const battleEnded = this.ended && this.state.turnLog.Lenght > 0;
                if (turnFlushed || battleEnded) {
                    clearInterval(check);
                    clearTimeout(timer);
                    resolve();
                }
            }, 50);
        })
    }
}

module.exports = BattleSession;