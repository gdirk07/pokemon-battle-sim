const { Teams } = require('pokemon-showdown');

function buildRandomSet() {
    const team1 = Teams.pack(Teams.generate("gen9randombattle").slice(0,1));
    return team1;
}

module.exports = { buildRandomSet };