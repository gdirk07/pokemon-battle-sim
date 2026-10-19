import fs from 'node:fs';
import path from 'node:path';

// Workers serve frontend/dist from the backend, so a build must exist. `npm run test:e2e` builds first.
export default function globalSetup() {
    const index = path.resolve(__dirname, '../frontend/dist/index.html');
    if (!fs.existsSync(index)) {
        throw new Error('frontend/dist is missing. Run `npm run build` (or use `npm run test:e2e`, which builds first).');
    }
}
