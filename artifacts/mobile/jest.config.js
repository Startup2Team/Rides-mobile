const path = require('path');

module.exports = {
  testEnvironment: 'node',
  resolver: '<rootDir>/jest.resolver.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(gif|jpe?g|png|webp)$': '<rootDir>/mocks/asset.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePaths: [path.join(__dirname, 'node_modules')],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/(expo@|react-native@|@react-native\\+|@testing-library\\+react-native@)|(expo|jest-react-native|react-native|@react-native(-community)?|@testing-library/react-native)/)',
  ],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
};
