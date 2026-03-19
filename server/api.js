const express = require('express');
const router = express.Router();
const BattleManager = require('../battle/BattleManager');

router.post('/battle/start', (req, res) => {
    const battle = BattleManager.createBattle();
    res.json({ battleId: battle.id });
});

router.post('/battle/move', (req, res) => {
    const { battleId, player, move } = req.body;

    const battle = BattleManager.getBattle(battleId);
    if (!battle) return res.status(404).send('Battle not found');

    battle.makeMove(player, move);
    res.json({ status: 'ok' });
});

router.post('/battle/state/:id', (req, res) => {
    const battle = BattleManager.getBattle(req.params.id);
    if (!battle) return res.status(404).send('Not found');

    res.json(battle.getState());
});

module.exports = router;