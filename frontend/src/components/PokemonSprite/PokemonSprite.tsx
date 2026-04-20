import { useRef, useState } from 'react';
import type { PokemonSprites } from '../../../../shared/types/battle';
import { SHOWDOWN_SPRITES_LOCAL, SHOWDOWN_SPRITES_CDN, SUBSTITUTE_BACK, SUBSTITUTE_FRONT, FLIPPED_HOME_SPRITES } from '../../config/constants';
import { toID, toSpriteID } from '../../utils/pokemon';

interface Props {
    sprites?: PokemonSprites,
    name: string,
    species?: string,
    variant: 'officialArtwork' | 'frontDefault' | 'backDefault',
    facing?: 'left' | 'right',
    size?: number,
    className?: string,
    hasSubstitute?: boolean,
}

export function PokemonSprites({ sprites, name, species, variant, facing, size = 96, className = '', hasSubstitute = false }: Props) {
    const indexRef = useRef(0);
    const [currentUrl, setCurrentUrl] = useState<string | null>(null);
    const id = toID(species ?? name);
    const hypId = toSpriteID(species ?? name);
    const TARGET = size;

    function spriteFacesRightDefault(url: string): boolean {
        if (url.includes('/home/')) {
            return FLIPPED_HOME_SPRITES.has(hypId);
        }
        if (url.includes('/ani-back/')) return true;
        if (url.includes('/ani/')) return false;
        return true;
    }

    function shouldFlip(url: string): boolean {
        if (!facing) return false;
        const facesRight = spriteFacesRightDefault(url);
        return facing === 'left' ? facesRight : !facesRight;
    }

    const fallbacks = [
        sprites?.[variant],
        `${SHOWDOWN_SPRITES_LOCAL}/home/${hypId}.png`,
        `${SHOWDOWN_SPRITES_LOCAL}/ani/${hypId}.gif`,
        `${SHOWDOWN_SPRITES_LOCAL}/ani-back/${hypId}.gif`,
        `${SHOWDOWN_SPRITES_CDN}/home/${id}.png`,
        `${SHOWDOWN_SPRITES_CDN}/home/${hypId}.png`,
        `${SHOWDOWN_SPRITES_CDN}/ani/${id}.gif`,
        `${SHOWDOWN_SPRITES_CDN}/ani/${hypId}.gif`,
        `${SHOWDOWN_SPRITES_CDN}/ani-back/${id}.gif`,
        `${SHOWDOWN_SPRITES_CDN}/ani-back/${hypId}.gif`,
    ].filter(Boolean) as string[];

    const activeUrl = currentUrl ?? fallbacks[0];
    const flipped = shouldFlip(activeUrl ?? '');
    const substituteUrl = variant === 'backDefault' ? SUBSTITUTE_BACK : SUBSTITUTE_FRONT;

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        console.log('sprite failed:', e.currentTarget.src);
        indexRef.current += 1
        if (indexRef.current < fallbacks.length) {
            const nextUrl = fallbacks[indexRef.current];
            e.currentTarget.src = nextUrl;
            setCurrentUrl(nextUrl);
        } else {
            e.currentTarget.style.display = 'none'
        }
    }
    return (
        <div 
            className='relative overflow-hidden flex items-center justify-center'
            style={{ width: TARGET, height: TARGET }}
        >
            <img
                src={fallbacks[0]}
                alt={name}
                style={{ 
                    width: 'auto', 
                    height: 'auto',
                    maxWidth: TARGET,
                    maxHeight: TARGET,
                    transform: `scale(1) ${flipped ? 'scaleX(-1)' : ''}`,
                    transformOrigin: 'center center',
                    imageRendering: 'pixelated',
                }}
                className={`[image-rendering:pixelated] transition-opacity duration-300 
                    ${hasSubstitute ? 'opacity-30' : 'opacity-100'}
                    ${className}`}
                onError={handleError}
            />
            {hasSubstitute && (
                    <img
                        src={substituteUrl}
                        alt="Substitute"
                        className="absolute inset-0 object-contain [image-rendering:pixelated] transition-opacity duration-300"
                    />
            )}
        </div>
    );
}