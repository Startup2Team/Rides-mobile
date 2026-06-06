const path = require('path');

module.exports = {
  testEnvironment: 'node',
  resolver: '<rootDir>/jest.resolver.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePaths: [path.join(__dirname, 'node_modules')],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/(react-native@|@react-native\\+|@testing-library\\+react-native@)|((jest-)?react-native|@react-native(-community)?|@testing-library/react-native)/)',
  ],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
};
