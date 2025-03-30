export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.m?js$': '$1',
  },
  transform: {
    '^.+\\.(m?ts|tsx)$': ['ts-jest', {
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.mts'],
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts'
  ],
}; 