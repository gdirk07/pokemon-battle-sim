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

    nextTurn(id) {
        const battle = this.battles.get(id);
        if (!battle) throw new Error(`Battle ${id} not found`);
        battle.nextTurn();
    }
    removeBattle(id) {
        this.battles.delete(id);
    }
}

module.exports = new BattleManager();