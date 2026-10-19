const { Teams, Dex } = require('pokemon-showdown');

const FORMAT = 'gen9randombattle';

let generator = null;
function getGenerator() {
    // Reused only for its set data / randomSet(); a fresh one per call would re-read sets.json.
    generator ??= Teams.getGenerator(FORMAT);
    return generator;
}

/**
 * Resolves user input ("iron crown", "Ho-Oh", "indeedeef") to a species in the random-battle pool.
 * Throws with a readable message so callers (overlay, HTTP, Streamer.bot) can surface it.
 */
function resolveSpecies(input) {
    const species = Dex.species.get(String(input ?? ''));
    if (!species.exists) throw new Error(`Unknown species "${input}"`);
    if (!getGenerator().randomSets[species.id]) throw new Error(`${species.name} is not in the ${FORMAT} pool`);
    return species.name;
}

// Every species that can be picked, display names, sorted.
function listSpecies() {
    return Object.keys(getGenerator().randomSets)
        .map(id => Dex.species.get(id).name)
        .sort((a, b) => a.localeCompare(b));
}

/** Packed single-Pokémon team. `species` picks the Pokémon (random set for it); omitted = fully random. */
function buildSet(species) {
    if (!species) return Teams.pack(Teams.generate(FORMAT).slice(0, 1));
    return Teams.pack([getGenerator().randomSet(resolveSpecies(species), {}, true)]);
}

module.exports = { buildSet, resolveSpecies, listSpecies };
