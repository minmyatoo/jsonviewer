module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^ace-builds$': '<rootDir>/node_modules/ace-builds',
  },
};
