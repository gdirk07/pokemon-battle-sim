const BattleSession = require('./BattleSession');

class BattleManager {
    constructor() {
        this.battles = new Map();
        this.counter = 1;
    }

    createBattle() {
        const id = `battle-${this.counter++}`;
        const battle = new BattleSession(id);

        this.battles.set(id, battle);
        return battle;
    }

    getBattle(id) {
        return this.battles.get(id);
    }
}

module.exports = new BattleManager();