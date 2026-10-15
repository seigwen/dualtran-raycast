/** Jest setup for the pure-logic suites and the vendored-core integration test. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
};
