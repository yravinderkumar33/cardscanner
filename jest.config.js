/** Tests cover only pure logic in lib/ — no React Native imports allowed there. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, strict: true, target: 'es2020' } },
    ],
  },
};
