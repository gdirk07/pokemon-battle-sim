const express = require('express');
const { listSpecies } = require('../battle/team-builder');

// Small control/debug surface. The overlay itself talks over WebSocket (/ws).
module.exports = function createApi(battleFlow) {
    const router = express.Router();

    router.get('/status', (_req, res) => res.json(battleFlow.status()));

    // Species that can be passed to `start` (the random-battle pool).
    router.get('/species', (_req, res) => res.json(listSpecies()));

    // Body = command args, e.g. POST /command/start { "p1Species": "Iron Crown", "p2Species": "Ho-Oh" }
    router.post('/command/:name', async (req, res) => {
        const result = await battleFlow.command(req.params.name, req.body ?? {});
        res.status(result.ok ? 200 : 409).json(result);
    });

    return router;
};
