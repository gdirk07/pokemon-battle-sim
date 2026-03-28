/* Used for dealing with mishandled pokeapi data */
const VIVILLON_PATTERNS = [
    'archipelago', 'continental', 'elegant', 'fancy', 'garden',
    'high-plains', 'icy-snow', 'jungle', 'marine', 'meadow',
    'modern', 'monsoon', 'ocean', 'poke-ball', 'polar',
    'river', 'sandstorm', 'savanna', 'sun', 'tundra',
];

export const specialPokemon: Record<string, string> = {
    'mimikyu': '778',
    'palafin': '964',
    'oricorio-pa\\u': 'oricorio-pau',
    'squawkabilly': '931',
    'squawkabilly-yellow': 'squawkabilly-yellow-plumage',
    'squawkabilly-green': 'squawkabilly-green-plumage',
    'squawkabilly-blue': 'squawkabilly-blue-plumage',
    'squawkabilly-white': 'squawkabilly-white-plumage',
    'maushold': '925',
    'meloetta': '648',
    'morpeko': '877',
    'eiscue': '875',
    'toxtricity': '849',
    'tauros-paldea-combat': '10250',
    'tauros-paldea-blaze': '10251',
    'tauros-paldea-aqua': '10252',
    'enamorous': '905',
    'ogerpon-wellspring': 'ogerpon-wellspring-mask',
    'ogerpon-hearthflame': 'ogerpon-hearthflame-mask',
    'ogerpon-cornerstone': 'orgerpon-cornerstone-mask',
    'thunderus': '642',
    'shaymin': 'shaymin-land',
    'greninja-bond': 'greninja-battle-bond',
};

export const genderForms = (name: string, gender: string | undefined): string => {
    if (genderedPokemon.has(parsePokemon(name.toLocaleLowerCase()))) {
        return gender === 'M' ? name + '-' + 'male' : name + '-' + 'female';
    }
    return name;
}

export const vivillonPatterns = (pattern: string): string => {
    const validPattern = VIVILLON_PATTERNS.includes(pattern) ? pattern : 'meadow'; //default
    return `https://pokeapi.co/api/v2/pokemon-form/vivillon-${validPattern}`;
}

export const gastrodonRegions = (name: string): string => {
    const isWest = name.split('-')[1].toLocaleLowerCase() === 'west' ? true : false;
    return isWest ? "https://pokeapi.co/api/v2/pokemon-form/423/" : "https://pokeapi.co/api/v2/pokemon-form/10040/";
}

export const polteageistForms = (name: string): string => {
    const isAntique = name.split('-')[1].toLowerCase() === 'antique' ? true : false;
    return isAntique ? 'https://pokeapi.co/api/v2/pokemon-form/10345/' : 'https://pokeapi.co/api/v2/pokemon-form/855/';
}

export const florgesForms = async (name: string) => {
    const data = await fetch('https://pokeapi.co/api/v2/pokemon/florges');
    const florgesData = await data.json();
    const formObject = florgesData.forms.find((form: any) => name.toLocaleLowerCase() === form.name);
    return formObject.url;
}

const parsePokemon = (name: string) => {
    const parsedName = name.split('-')[0].toLowerCase();
    return parsedName;
}

const genderedPokemon = new Set<string>([
    'meowstic',
    'indeedee',
    'oinkologne',
    'basculegion',
]);