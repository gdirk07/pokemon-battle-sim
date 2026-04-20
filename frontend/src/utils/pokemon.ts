export function toID(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function toSpriteID(name: string): string {
    return name
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]+/g, '');

}