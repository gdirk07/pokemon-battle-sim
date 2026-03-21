function parseOutput(chunk) {
    const lines = chunk.split('\n');

    return lines
        .filter(line => line.startsWith('|'))
        .map(line => {
            const parts = line.split('|');
            return {
                raw: line,
                type: parts[1],
                data: parts.slice(2)
            };
        });
}

module.exports = { parseOutput };