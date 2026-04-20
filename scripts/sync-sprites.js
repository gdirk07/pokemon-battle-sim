const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL    = 'https://play.pokemonshowdown.com/sprites';
const OUTPUT_DIR  = path.join(__dirname, '../frontend/public/sprites');

const FOLDERS = [
    'home',
    'ani',
    'ani-back',
    'substitutes',
];

function get(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return resolve(get(res.headers.location));
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
            res.on('error', reject);
        }).on('error', reject);
    })
}

async function getFileList(folder) {
    const url = `${BASE_URL}/${folder}/`;
    const { body } = await get(url);
    const html  = body.toString();

    // Parse filenames from directory listing
    const matches = [...html.matchAll(/href="([^"]+\.(png|gif))"/g)];
    return matches.map(m => m[1]);
}

async function syncFolder(folder) {
    const outDir = path.join(OUTPUT_DIR, folder);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\nSyncing ${folder}...`);
    const files = await getFileList(folder);
    console.log(`Found ${files.length} files`);

    let downloaded = 0;
    let skipped    = 0;

    for (const file of files) {
        const outPath = path.join(outDir, file);

        // Skip if file already exists — only download new ones
        if (fs.existsSync(outPath)) {
            skipped++;
            continue;
        }

        const url = `${BASE_URL}/${folder}/${file}`
        try {
            const { status, body } = await get(url);
            if (status === 200) {
                fs.writeFileSync(outPath, body);
                downloaded++;
                if (downloaded % 50 === 0) console.log(`  Downloaded ${downloaded} new files...`);
            }
        } catch (err) {
            console.error(`  Failed: ${file}`, err.message);
        }
    }

    console.log(`  Done — ${downloaded} new, ${skipped} already existed`);
}

const EXTRA_FILES = [
    {
        url: 'https://play.pokemonshowdown.com/data/pokedex.json',
        dest: path.join(__dirname, '../frontend/public/data/pokedex.json'),
    }
];

async function syncExtraFiles() {
    for (const file of EXTRA_FILES) {
        fs.mkdirSync(path.dirname(file.dest), { recursive: true })
        console.log(`Downloading ${file.url}...`);
        const { body } = await get(file.url);
        fs.writeFileSync(file.dest, body);
        console.log(`Saved to ${file.dest}`);
    }
}

async function main() {
    console.log('Pokemon Showdown sprite sync');
    console.log(`Output: ${OUTPUT_DIR}\n`);
    await syncExtraFiles();
    for (const folder of FOLDERS) {
        await syncFolder(folder);
    }

    console.log('\nSync complete!');
}

main().catch(console.error);