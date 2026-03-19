const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { parseOutput } = require('./parser');
const { broadcast } = require('../server/socket');

class BattleSession {
    constructor(id) {
        this.id = id;
        this.stream = new BattleStream();

        const players = getPlayerStreams(this.stream);
        this.p1 = players.p1;
        this.p2 = players.p2;

        this.state = {
            turn: 0,
            log: [],
            request: null,
        };

        this.init();
        this.listen();
    }

    init() {
        this.stream.write(`>start {"formatid":"gen9randombattle"}`);
        this.stream.write(`>player p1 {"name":"Challenger 1"}`);
        this.stream.write(`>player p2 {"name":"Challenger 2"}`);
    }

    listen() {
        (async () => {
            for await (const chunk of this.stream) {
                const events = parseOutput(chunk);
                events.forEach(e => this.handleEvent(e));

                broadcast({
                    type: 'battle_update',
                    battleId: this.id,
                    state: this.state
                });
            }
        })();
    }

    handleEvent(event) {
        this.state.log.push(event.raw);

        if (event.type === 'turn') {
            this.state.turn = parseInt(event.data[0]);
        }

        if (event.type === 'request') {
            try {
                this.state.request = JSON.parse(event.data.join('|'));
            } catch {}
        }
    }

    makeMove(player, moveIndex) {
        if (player === 'p1') {
            this.p1.write(`move ${moveIndex}`);
        } else {
            this.p2.write(`move ${moveIndex}`);
        }
    }

    getState() {
        return this.state;
    }
}

module.exports = BattleSession;