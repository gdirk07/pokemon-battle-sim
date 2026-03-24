import { specialPokemon } from '../../../shared/pokeApi/pokemonFilter';

const CACHE_PREFIX = 'pokeapi_sprite_';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface PokemonSprites {
    officialArtwork: string | null,
    frontDefault: string | null,
    backDefault: string | null,
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getSprites(pokemonName: string): Promise<PokemonSprites> {
    let formatedString: string = pokemonName.replaceAll(' ', '-');
    if (formatedString in specialPokemon) {
        formatedString = specialPokemon[formatedString];
    }
    const key = CACHE_PREFIX + formatedString.toLowerCase();
    const fallback: PokemonSprites = { officialArtwork: null, frontDefault: null, backDefault: null};

    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${formatedString.toLocaleLowerCase()}`);

            if (res.status === 404) {
                console.warn(`PokeAPI: no entry found for "${pokemonName}", skipping retries`);
                return fallback;
            }

            if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);

            const data = await res.json();

            const sprites: PokemonSprites = {
                officialArtwork: data.sprites.other['official-artwork'].front_default ?? null,
                frontDefault: data.sprites.front_default ?? null,
                backDefault: data.sprites.back_default ?? null,
            };

            localStorage.setItem(key, JSON.stringify(sprites));
            return sprites;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error('Unknown error');

            if (attempt < MAX_RETRIES) {
                console.warn(`PokeAPI: attempt ${attempt}/${MAX_RETRIES} failed for "${pokemonName}", retrying in ${RETRY_DELAY_MS * attempt}ms...`);
                await wait(RETRY_DELAY_MS * attempt);
            }
            
        }
    }
    console.error(`PokeAPI: all ${MAX_RETRIES} attempts failed for "${pokemonName}":`, lastError);
    return fallback;
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