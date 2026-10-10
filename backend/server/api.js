const express = require('express');

// Small control/debug surface. The overlay itself talks over WebSocket (/ws).
module.exports = function createApi(battleFlow) {
    const router = express.Router();

    router.get('/status', (_req, res) => res.json(battleFlow.status()));

    router.post('/command/:name', async (req, res) => {
        const result = await battleFlow.command(req.params.name);
        res.status(result.ok ? 200 : 409).json(result);
    });

    return router;
};
