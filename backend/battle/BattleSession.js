const { BattleStream, getPlayerStreams } = require('pokemon-showdown');
const { parseOutput } = require('./parser');
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
            lastWinner: null,
        };
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
                for (const event of events) {
                    this.handleEvent(event);
                }
            }
        })();
    }

    handleEvent(event) {
        this.state.log.push(event.raw);
        switch (event.type) {
            case 'turn':
                this.state.turn = parseInt(event.data[0]);
                break;

            case 'request':
                this.handleRequest(event);
                break;

            case 'win':
                this.handleWin(event);
                break;
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
            if (!request.active || !request.active[0].moves) return;            
        } catch (err) {
            console.error('Failed to handle request:', err);
        }
    }

    handleWin(event) {
        if (this.ended) return;
        this.ended = true;

        const winner = event.data[0];
        this.state.lastWinner = winner;

        console.log(`[${this.id}] Winner: ${winner}`);
    }

    nextTurn() {
        const move1 = Math.floor(Math.random() * 4) + 1
        const move2 = Math.floor(Math.random() * 4) + 1
        this.stream.write(`>p1 move ${move1}`);
        this.stream.write(`>p2 move ${move2}`);
    }
    getState() {
        return this.state;
    }
}

module.exports = BattleSession;