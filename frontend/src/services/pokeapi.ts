import { specialPokemon, vivillonPatterns, gastrodonRegions, polteageistForms, florgesForms } from '../../../shared/pokeApi/pokemonFilter';

const CACHE_PREFIX = 'pokeapi_sprite_';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface PokemonSprites {
    officialArtwork: string | null,
    frontDefault: string | null,
    backDefault: string | null,
    reverseFrontDefault: string | null
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getSprites(pokemonName: string): Promise<PokemonSprites> {
    let formatedString: string = pokemonName.replaceAll(' ', '-').toLowerCase();

    console.log(`Checking ${formatedString}!`);
    if (formatedString in specialPokemon) {
        formatedString = specialPokemon[formatedString];
    }
    if (formatedString.split('-')[0] === 'pikachu') formatedString = 'pikachu';
    const key = CACHE_PREFIX + formatedString.toLowerCase();
    const fallback: PokemonSprites = { officialArtwork: null, frontDefault: null, backDefault: null, reverseFrontDefault: null};

    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    let lastError: Error | null = null;

    if (formatedString.split('-')[0] === 'arceus') {
        formatedString = formatedString.split('-')[0].toLocaleLowerCase();
    }
    let vivillonPattern = formatedString.split('-')[0] === 'vivillon' ? formatedString.split('-')[1] : '';
    let isGastrodon = formatedString.split('-')[0] === 'gastrodon' && formatedString.split('-').length > 1;
    let isAlcremie = formatedString.split('-')[0] === 'alcremie';
    let isPolteageist = formatedString.split('-')[0] === 'polteageist' && formatedString.split('-').length > 1;
    let isFlorges = formatedString.split('-')[0] === 'florges';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            let res;
            if (vivillonPattern !== '') {
                res = await fetch(vivillonPatterns(vivillonPattern));
            }
            else if (isGastrodon) {
                res = await fetch(gastrodonRegions(formatedString));
            }
            else if (isAlcremie) {
                res = await fetch(`https://pokeapi.co/api/v2/pokemon/alcremie`);
            }
            else if (isPolteageist) {
                res = await fetch(polteageistForms(formatedString));
            }
            else if (isFlorges) {
                res = await fetch(florgesForms(formatedString).toString());
            }
            else {
                res = await fetch(`https://pokeapi.co/api/v2/pokemon/${formatedString.toLocaleLowerCase()}`);
            }
            
            if (res.status === 404) {
                console.warn(`PokeAPI: no entry found for "${pokemonName}", skipping retries`);
                return fallback;
            }

            if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);

            const data = await res.json();

            const otherSection = data.sprites?.other;
            let sprites: PokemonSprites;
            if (otherSection) {
                sprites = {
                    officialArtwork: otherSection['official-artwork'].front_default ?? data.sprites.front_default,
                    frontDefault: otherSection['showdown']?.front_default ? otherSection['showdown'].front_default : data.sprites.front_default ?? null,
                    backDefault: otherSection['showdown']?.back_default ? otherSection['showdown'].back_default : data.sprites.back_default ?? null,
                    reverseFrontDefault: null,
                }
            }
            else {
                sprites = {
                    officialArtwork: data.sprites?.front_default,
                    frontDefault: data.sprites?.front_default  ?? null,
                    backDefault: data.sprites?.back_default  ?? null,
                    reverseFrontDefault: null,
                }
            }
            

            if (!sprites.backDefault) {
                sprites.reverseFrontDefault = sprites.frontDefault;
            }
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