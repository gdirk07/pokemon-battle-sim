const express = require('express');
const router = express.Router();
const BattleManager = require('../battle/BattleManager');

router.post('/battle/start', async (req, res) => {
    try {
        const battle = BattleManager.createBattle();
        const combatants = await battle.startBattle();
        res.json({ 
            id: battle.id,
            player1: combatants[0][0],
            player2: combatants[1][0],
            turn: 1,
            log: [],
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Failed to start battle');
    }   
});

router.get('/battle/state/:id', (req, res) => {
    const battle = BattleManager.getBattle(req.params.id);
    const battleState = battle.getState();
    if (!battle) return res.status(404).send('Not found');
    res.json(battleState);
});

router.post('/battle/nextturn/:id', async (req, res) => {
    try {
        const battle = BattleManager.getBattle(req.params.id);
        if (!battle) return res.status(404).send('Not found');

        battle.nextTurn();
        await battle.waitForTurn();

        res.json(battle.getState());
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to advance turn');
    }
})
module.exports = router;