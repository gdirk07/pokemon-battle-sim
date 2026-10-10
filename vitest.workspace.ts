import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'backend',
      root: './backend',
      environment: 'node',
      include: ['**/__test__/**/*.test.js'],
    },
  },
  {
    test: {
      name: 'frontend',
      root: './frontend',
      environment: 'jsdom',
      include: ['**/__tests__/**/*.test.{js,ts,jsx,tsx}'],
    },
  },
]);