const CACHE_PREFIX = 'pokeapi_sprite_';

interface PokemonSprites {
    officialArtwork: string | null,
    frontDefault: string | null,
    backDefault: string | null,
};

async function getSprites(pokemonName: string): Promise<PokemonSprites> {
    const key = CACHE_PREFIX + pokemonName.toLowerCase();

    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    try {
        const rest = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName.toLocaleLowerCase()}`);
        if (!rest.ok) throw new Error(`PokeAPI returned ${rest.status}`);

        const data = await rest.json();

        const sprites: PokemonSprites = {
            officialArtwork: data.sprites.other['official-artwork'].front_default ?? null,
            frontDefault: data.sprites.front_default ?? null,
            backDefault: data.sprites.back_default ?? null,
        };
        localStorage.setItem(key, JSON.stringify(sprites));

        return sprites;
    } catch (err) {
        console.warn(`Failed to fetch sprites for ${pokemonName}:`, err);
        return { officialArtwork: null, frontDefault: null, backDefault: null};
    }
}

export async function fetchBattleSprites(
    pokemon1: string,
    pokemon2: string
){
    const [pokemon1Sprites, pokemon2Sprites] = await Promise.all([
        getSprites(pokemon1),
        getSprites(pokemon2)
    ]);
    return { pokemon1Sprites, pokemon2Sprites };
}