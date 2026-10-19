import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        projects: [
            { extends: true, test: { name: 'backend', root: './backend', environment: 'node', include: ['**/__test__/**/*.test.js'] } },
            './frontend',
        ],
    },
});