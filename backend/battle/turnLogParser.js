const { logUnknownEvent } = require('../loggers/unknownEventLogger');

function parsePokemonName(ident) {
    return ident.split(': ')[1] ?? ident;
}

function formatMoveName(move) {
    return move
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^[a-z]/, c => c.toUpperCase())
        .replace(/(\w)(\w*)/g, (_, first, rest) => first.toUpperCase() + rest);
}

// Converts a raw Showdown protocol line into a readable string
// Returns null for lines that don't need to be displayed
function parseTurnLogLine(raw) {
    const parts = raw.split('|');
    const type = parts[1];

    switch (type) {
        case 'move': {
            const user = parsePokemonName(parts[2]);
            const move = formatMoveName(parts[3]);
            return `${user} used ${move}!`;
        }

        case 'switch': {
            const pokemon = parsePokemonName(parts[2]);
            return `${pokemon} was sent out!`;
        }

        //not currently used but for later maybe
        case 'drag': {
            const pokemon = parsePokemonName(parts[2]);
            return `${pokemon} was dragged out!`;
        }

        case '-damage': {
            const pokemon = parsePokemonName(parts[2]);
            const condition = parts[3];
            const from = parts[4] ?? '';
            
            if (!condition || condition.startsWith('0 fnt') || condition === '0') {
                return `${pokemon} fainted!`;
            }
            const hpPart = condition.split(' ')[0];
            const [current, max] = hpPart.split('/').map(Number);

            if (isNaN(current) || isNaN(max) || max === 0) return null;

            let percentage = Math.round((current / max) * 100);
            if (percentage === 0 && current > 0) percentage = 1;
            if (from.includes('Life Orb')) {
                return `${pokemon} lost some of its HP! (${percentage}% HP remaining)`;
            }
            if (from.includes('Leech Seed')) {
                return `${pokemon}'s health is sapped by Leech Seed!`;
            }
            if (from.includes('Recoil')) {
                return `${pokemon} took some damage from recoil!`;
            }
            if (from.includes('confusion')) {
                return `${pokemon} hurt itself in confusion!`;
            }
            if (from.includes('Rocky Helmet')) {
                return `${pokemon} took some damage from Rocky Helmet!`;
            }
            if (from.includes('Salt Cure')) {
                return `${pokemon} is hurt by Salt Cure!`;
            }
            if (from.includes('psn')) {
                return `${pokemon} is hurt by poison!`;
            }
            return `${pokemon} took damage! (${percentage}% HP remaining)`;
        }

        case '-heal': {
            const pokemon = parsePokemonName(parts[2]);
            const from = parts[4] ?? '';
            const misc = parts[5] ?? '';

            if (from.includes('item: Leftovers')) {
                return `${pokemon} restored some HP from their Leftovers!`;
            }
            if (from.includes('drain')) {
                return `${pokemon} absorbed some energy!`;
            }
            if (from.includes('[silent]')) {
                return;
            }
            if (from.includes('Wish')) {
                return `${misc}'s wish came true!`;
            }
            if (misc && misc.includes('[silent]')) return;
            return `${pokemon} restored some HP!`;
        }

        case '-supereffective': {
            return `It's super effective!`;
        }

        case '-resisted': {
            return `It's not very effective...`;
        }

        case '-immune': {
            const pokemon = parsePokemonName(parts[2]);

            return `It doesn't affect ${pokemon}!`;
        }

        case '-miss': {
            const attacker = parsePokemonName(parts[2]);
            return `${attacker}'s attack missed!`;
        }

        case '-crit': {
            return `Critical hit!`;
        }

        case '-status': {
            const pokemon = parsePokemonName(parts[2]);
            const status = formatStatus(parts[3]);
            return `${pokemon} was ${status}!`;
        }

        case '-curestatus': {
            const pokemon = parsePokemonName(parts[2]);
            const status = parts[3]

            const statsMap = {
                'slp': `${pokemon} woke up!`,
                'frz': `${pokemon} managed to thaw out!`,
            }

            if (statsMap[status]) return statsMap[status];
            
            logUnknownEvent(raw);
            return `${pokemon} was cured of its status condition!`;
        }

        case '-hitcount': {
            const hits = parts[3];
            return `Hit ${hits} time(s)!`;
        }

        case '-boost': {
            const pokemon = parsePokemonName(parts[2]);
            const stat = formatStat(parts[3]);
            const amount = parseInt(parts[4]);
            return `${pokemon}'s ${stat} ${amount > 1 ? 'sharply rose' : 'rose'}!`;
        }

        case '-unboost': {
            const pokemon = parsePokemonName(parts[2]);
            const stat = formatStat(parts[3]);
            const amount = parseInt(parts[4]);
            return `${pokemon}'s ${stat} ${amount > 1 ? 'harshly fell' : 'fell'}!`;
        }

        case '-weather': {
            const weather = formatWeather(parts[2]);

            return weather ? weather : null;
        }

        case '-fieldstart': {
            const effect = parts[2].replace('move: ', '');
            return `${effect} was set up!`;
        }

        case '-fieldend': {
            const effect = parts[2].replace('move: ', '');
            return `${effect} ended!`;
        }

        case '-sidestart': {
            const pokemon = parsePokemonName(parts[2]);
            const effect = parts[3]?.replace('move: ', '');
            const sidestartMap = {
                'Stealth Rock': 'Stealth Rock was set up!',
                'Toxic Spikes': 'Toxic Spikes was set up!',
                'Spikes': 'Spikes was set up!',
                'Sticky Web': 'A sticky net was set up!',
                'Light Screen': `${pokemon} put up a Light Screen!`,
                'Reflect': `${pokemon} put up a mystical wall!`,
                'Aurora Veil': `Aurora veil was set up on ${pokemon}'s side!`,
            }
            if (sidestartMap[effect]) return sidestartMap[effect];

            logUnknownEvent(raw);
            return `${effect} was set up!`;
        }

        case '-sideend': {
            const effect = parts[3];
            return `${effect} ended!`;
        }

        case '-ability': {
            const pokemon = parsePokemonName(parts[2]);
            const ability = parts[3];
            return `${pokemon}'s ${ability} activated!`;
        }

        case '-item': {
            const pokemon = parsePokemonName(parts[2]);
            const item = parts[3];
            const from = parts[4] ?? '';

            if (from.includes('move: Trick') || from.includes('move: Switcheroo')) {
                return `${pokemon} received ${item}!`;
            }

            if (from.includes('move: Thief') || from.includes('move: Covet')) {
                return `${pokemon} stole ${item}!`;
            }

            if (from.includes('move: Recycle')) {
                return `${pokemon} recycled its ${item}!`;
            }

            if (from.includes('ability: Harvest')) {
                return `${pokemon} harvested one ${item}!`;
            }
            return `${pokemon} used its ${item}!`;
        }

        case '-enditem': {
            const pokemon = parsePokemonName(parts[2]);
            const item = parts[3];
            const from = parts[4] ?? '';

            if (from.includes('move: Knock Off')) {
                return `${pokemon}'s ${item} was knocked off!`;
            }
            if (item.includes('Focus Sash')) {
                return `${pokemon} held on with Focus Sash!`;
            }
            return `${pokemon}'s ${item} was consumed!`;
        }

        case '-fail': {
            const pokemon = parsePokemonName(parts[2]);
            const reason =  parts.length > 3 ? parts[3].replace('move: ', '') : '';
            const misc = parts[4] ?? '';

            const reasonMap = {
                unboost:    `${pokemon}'s stats can't go any lower!`,
                boost:      `${pokemon}'s stats can't go any higher!`,
                slp:        `${pokemon} is already asleep!`,
                par:        `${pokemon} is already paralyzed!`,
                brn:        `${pokemon} is already burned!`,
                frz:        `${pokemon} is already frozen!`,
                psn:        `${pokemon} is already poisoned!`,
                tox:        `${pokemon} is already badly poisoned!`,
                sub:        `${pokemon} already has a substitute!`,
                immune:     `It doesn't affect ${pokemon}!`,
                heal:       `${pokemon} doesn't need healing!`,
                typechange: `${pokemon}'s type can't be changed!`,
                Substitute: misc === '[weak]'
                ? 'But it does not have enough HP left!'
                : 'But it failed!',
            }

            if (reasonMap[reason]) return reasonMap[reason];

            if (reason) logUnknownEvent(raw);
            return `But it failed`;
        }

        case '-singleturn': {
            const pokemon = parsePokemonName(parts[2]);
            const move = parts[3]?.replace('move: ', '') ?? '';

            const singleturnMap = {
                'Protect': `${pokemon} protected itself!`,
                'Detect': `${pokemon} protected itself!`,
                'Endure': `${pokemon} endured the hit!`,
                'Focus Punch': `${pokemon} is tightening its focus`,
                'Snatch': `${pokemon} is waiting for a move to snatch!`,
                'Beak Blast': `${pokemon} started heating up its beak!`,
                'Roost': `${pokemon} landed and took a rest!`,
            }

            if (singleturnMap[move]) return singleturnMap[move];

            logUnknownEvent(raw);
            return `${pokemon} used ${move}!`;
        }

        case '-singlemove': {
            const pokemon = parsePokemonName(parts[2]);
            const move = parts[3]?.replace('move: ', '') ?? '';
            const misc = parts[4] ?? '';

            if (misc === '[silent]') return;

            const singlemoveMap = {
                'Destiny Bond': `${pokemon} is trying to take its attacker down with it!`,
                'Grudge': `${pokemon} wants its attacker to bear a grudge!`,
            }

            if (singlemoveMap[move]) return singlemoveMap[move];

            logUnknownEvent(raw);
            return `${pokemon} used ${move}!`;
        }

        case 'cant': {
            const pokemon = parsePokemonName(parts[2]);
            const reason = parts[3]?.replace('ability: ', '').replace('move: ', '') ?? '';
            const move = parts[4] ? formatMoveName(parts[4]) : null;
            const of = parts[5] ? parsePokemonName(parts[5]) : null;

            const cantMap = {
                par:      `${pokemon} is paralyzed! It can't move!`,
                slp:      `${pokemon} is fast asleep!`,
                frz:      `${pokemon} is frozen solid!`,
                flinch:   `${pokemon} flinched and couldn't move!`,
                recharge: `${pokemon} must recharge!`,
                Disable:  `${pokemon}'s ${move} is disabled!`,
                truant:   `${pokemon} is loafing around!`,
                Truant: `${pokemon} is loading around!`,
                imprison: `${pokemon} can't use the move!`,
                taunt:    `${pokemon} is taunted and can't use ${move}!`,
                gravity:  `${pokemon} can't use ${move} due to gravity!`,
                heal:     `${pokemon} can't use ${move} due to the healing wish!`,
                Taunt:  `${pokemon} cannot move due to the taunt!`,
                'Queenly Majesty': `${of} cannot use ${move} around the Queenly Majesty!`,
                Attract: `${pokemon} is immobilized by love!`,
            }

            if (reason.includes("Heal Block")) {
                if (move) {
                    return `${pokemon} couldn't use ${move} due to Heal Block!`;
                }
                else {
                    return `${pokemon} couldn't heal due to Heal Block!`;
                }
            }
            if (cantMap[reason]) return cantMap[reason];

            logUnknownEvent(raw);
            return `${pokemon} couldn't move!`;
        }

        case '-notarget': {
            const pokemon = parsePokemonName(parts[2]);
            return `There was no target for ${pokemon}'s move!`;
        }

        case '-block': {
            return;
        }

        case '-activate': {
            const pokemon = parsePokemonName(parts[2]);
            const effect = parts[3]?.replace('move: ', '')
                .replace('ability: ', '') ?? '';
            const misc = parts[4] ?? '';

            const activateMap = {
                'Trick': `${pokemon} switched items with its target!`,
                'Protect': `${pokemon} protected itself!`,
                'Detect': `${pokemon} protected itself!`,
                'Endure': `${pokemon} endured the hit!`,
                'Poltergeist': `${pokemon} is about to be attacked by it's ${misc}`,
                'Tera Shell': `${pokemon} made its shell gleam! It's distorting type matchups!`,
                'Substitute': `${pokemon}'s substitute took the damage!`,
                'confusion': `${pokemon} is confused!`,
                'Disguise': `${pokemon}'s disguise broke!`,
                'Ice Face': `${pokemon}'s ice head took the attack!`,
                'Attract': misc 
                ? `${pokemon} is in love with ${misc}!`
                : `${pokemon} is in love!`,
                'Synchronize': `${pokemon}'s Synchronize activates!`,
                'Toxic Debris': `${pokemon} scattered poison spikes at the feet of the opposing team!`,
                'Whirlpool': `${pokemon} was trapped in the vortex!`,
                'Fickle Beam': `${pokemon} is going all out for this attack!`,
                'Dancer': `${pokemon} takes the stage and dances!`,
                'Destiny Bond': `${pokemon} took its foe with it!`,
                'Heal Bell': `${pokemon}'s bell chimed!`,
                'Psychic Terrain': `The battlefield got weird!`,
                'Cud Chew': `${pokemon}'s Cud Chew triggered the effect of the berry again!`,
            }

            if (activateMap[effect]) return activateMap[effect];

            logUnknownEvent(raw);
            return 'something activated!';
        }

        case '-start': {
            const pokemon = parsePokemonName(parts[2]);
            const effect = parts[3]?.replace('move: ', '')
                .replace('ability: ', '')
            const fourth = parts[4] ?? '';
            const fifth = parts[5] ?? '';

            if (fourth && fourth === '[silent]') return;

            const startMap = {
                'Encore': `${pokemon} fell for the encore!`,
                'confusion': `${pokemon} became confused!`,
                'Substitute': `${pokemon} made a substitute!`,
                'Leech Seed': `${pokemon} was seeded!`,
                'Taunt': `${pokemon} fell for the taunt!`,
                'Heal Block': `${pokemon} is prevented from healing!`,
                'typechange': `${pokemon}'s type changed to ${fourth}!`,
                'Yawn': `${pokemon} grew drowsy!`,
                'Attract': fourth
                    ? `${pokemon} is infatuated by the ${fourth}!`
                    : `${pokemon} is infatuated!`,
                'Disable': fourth && fifth 
                    ? `${pokemon}'s ${fourth} was disabled by the ${fifth}`
                    : `${pokemon}'s move was disabled!`,
                'Curse': `${pokemon} was cursed!`,
                'Nightmare': `${pokemon} fell into a nightmare!`,
                'Torment': `${pokemon} is tormented!`,
                'Aqua Ring': `${pokemon} surrounded itself with a veil of water!`,
                'Ingrain': `${pokemon} planted its roots!`,
                'Smack Down': `${pokemon} was knocked down!`,
                'Power Trick': `${pokemon} switched its Attack and Defense!`,
                'Charge': `${pokemon} is charging power!`,
                'Laser Focus': `${pokemon} is focusing!`,
                'Salt Cure': `${pokemon} became fully salt cured!`,
                'Future Sight': `${pokemon} foresaw an attack!`,
                'Flash Fire': `${pokemon}'s Flash Fire activated!`,
                'Magnet Rise': `${pokemon} levitated with electromagnetism!`,
            }
            if (startMap[effect]) return startMap[effect];

            logUnknownEvent(raw);
            return 'something happened!';
        }

        case '-end': {
            const pokemon = parsePokemonName(parts[2]);
            const effect = parts[3].replace('move: ', '');
            const misc = parts[4] ?? '';

            if (misc && misc === '[silent]') return;
            const endMap = {
                'Encore': `${pokemon}'s encore ended!`,
                'Substitute': `${pokemon}'s substitute broke!`,
                'Taunt': `${pokemon} is no longer taunted!`,
                'Heal Block': `${pokemon}'s Heal Block wore off!`,
                'confusion': `${pokemon} snapped out of its confusion!`,
                'Future Sight': `${pokemon} took the Future Sight attack!`,
                'Disable': `${pokemon}'s move is no longer disabled!`,
                'Magnet Rise': `${pokemon}'s electromagnetism wore off!`,
                'Slow Start': `${pokemon} finally got it together!`,
            }

            if (endMap[effect]) return endMap[effect];

            logUnknownEvent(raw);
            return 'something ended!';
        }

        case '-sethp': {
            const pokemon = parsePokemonName(parts[2]);
            const reason = parts[4].replace('move: ', '').replace('[from] ', '') ?? '';
            const misc = parts[5] ?? '';

            if (misc === '[silent]') return;
            const reasonMap = {
                'Pain Split': `${pokemon} shares its pain with the target!`,
            }
            if (reasonMap[reason]) return reasonMap[reason];

            logUnknownEvent(raw);
            return 'hp was set!';

        }

        case '-setboost': {
            const pokemon = parsePokemonName(parts[2]);
            const stat = parts[3] ?? '';
            const level = parts[4] ?? '';
            const move = parts[5] ?? '';

            if (move && move.includes('Belly Drum')) {
                return `${pokemon} cut its own HP and maximized its Attack!`;
            }
            logUnknownEvent(raw);
            return 'a stat was boosted!'
        }
        case '-formechange': {
            const pokemon = parsePokemonName(parts[2]);
            const effect = parts[5] ?? '';
            
            if (effect.includes('ability: Shields Down')) {
                return `${pokemon}'s Shields Down activated!`;
            }
        }

        case '-clearallboost': {
            return 'All stat changes have beeen cleared!';
        }

        case 'turn': {
            return `--- Turn ${parts[2]} ---`;
        }

        case 'win': {
            return `${parts[2]} won the battle!`;
        }

        case 'tie': {
            return `The battle ended in a tie!`;
        }

        // Ignored — not useful for display so far
        case 'request':
        case 'upkeep':
        case 'teamsize':
        case 'gametype':
        case 'gen':
        case 'tier':
        case 'rule':
        case 'start':
        case '':
        case undefined:
            return null;

        default:
            return null;
    }
}

function formatStatus(status) {
    const map = {
        brn:  'burned',
        par:  'paralyzed',
        slp:  'put to sleep',
        frz:  'frozen',
        psn:  'poisoned',
        tox:  'badly poisoned',
    };
    return map[status] ?? status;
}

function formatStat(stat) {
    const map = {
        atk:  'Attack',
        def:  'Defense',
        spa:  'Sp. Atk',
        spd:  'Sp. Def',
        spe:  'Speed',
        accuracy: 'Accuracy',
        evasion:  'Evasion',
    };
    return map[stat] ?? stat;
}

function formatWeather(weather) {
    const map = {
        SunnyDay:    'The sunlight turned harsh!',
        RainDance:   'It started to rain!',
        Sandstorm:   'A sandstorm kicked up!',
        Hail:        'It started to hail!',
        Snow:        'It started to snow!',
        DesolateLand:    'The sunlight turned extremely harsh!',
        PrimordialSea:   'A heavy rain began to fall!',
        none:        'The weather cleared up!',
    };
    return map[weather] ?? null;
}

// Parses an array of raw event lines into readable strings, filtering nulls
function parseTurnLog(entries) {
    return entries
        .map(entry => ({
            text: parseTurnLogLine(entry.raw),
            hp: entry.hp ?? null,
            status: entry.status ?? null,
            substitute: entry.substitute ?? null,
        }))
        .filter(entry => entry.text !== null);
}

module.exports = { parseTurnLog };