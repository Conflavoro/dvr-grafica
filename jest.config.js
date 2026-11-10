// Jest config via next/jest (transform SWC, alias @/* gestiti da Next).
// I test del DataSource non usano il DOM: ambiente 'node' + polyfill minimi
// (localStorage/sessionStorage/window) in jest.setup.js. Cosi' non serve
// aggiungere la dipendenza jest-environment-jsdom.

const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

module.exports = createJestConfig(customConfig);
