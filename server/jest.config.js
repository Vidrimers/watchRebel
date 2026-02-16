export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Игнорируем тесты на node:test (они запускаются отдельно)
    'watchlist.property.test.js',
    'ratings.property.test.js',
    'lists.property.test.js',
    'progress.property.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Принудительное завершение после тестов
  forceExit: true,
  // Обнаружение открытых хендлов
  detectOpenHandles: false
};
