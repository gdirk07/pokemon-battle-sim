const express = require('express');
const router = express.Router();
const BattleManager = require('../battle/BattleManager');

router.post('/battle/start', async (req, res) => {
    try {
        const battle = BattleManager.createBattle();
        await battle.startBattle();
        res.json({ battleId: battle.id });
    } catch (e) {
        console.error(e);
        res.status(500).send('Failed to start battle');
    }   
});

router.get('/battle/state/:id', (req, res) => {
    const battle = BattleManager.getBattle(req.params.id);
    if (!battle) return res.status(404).send('Not found');
    res.json(battle.getState());
});

router.post('/battle/nextturn/:id', (req, res) => {
    const battle = BattleManager.getBattle(req.params.id);
    if (!battle) return res.status(404).send('Not found');
    res.json(battle.nextTurn());
})
module.exports = router;