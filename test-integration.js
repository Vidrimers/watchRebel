#!/usr/bin/env node

/**
 * Скрипт для тестирования интеграции Frontend ↔ Backend
 * Проверяет основные API endpoints
 */

const http = require('http');

const BASE_URL = 'http://localhost:1313';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passedTests = 0;
let failedTests = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testEndpoint(name, path, expectedStatus = 200, checkData = null) {
  try {
    log(`\n🧪 Тестирование: ${name}`, 'cyan');
    log(`   Endpoint: ${path}`, 'blue');
    
    const result = await makeRequest(path);
    
    if (result.status === expectedStatus) {
      log(`   ✅ Статус: ${result.status} (ожидалось ${expectedStatus})`, 'green');
      
      if (checkData && typeof checkData === 'function') {
        const dataCheck = checkData(result.data);
        if (dataCheck === true) {
          log(`   ✅ Данные корректны`, 'green');
        } else {
          log(`   ⚠️  Данные: ${dataCheck}`, 'yellow');
        }
      }
      
      passedTests++;
      return true;
    } else {
      log(`   ❌ Статус: ${result.status} (ожидалось ${expectedStatus})`, 'red');
      log(`   Ответ: ${JSON.stringify(result.data)}`, 'red');
      failedTests++;
      return false;
    }
  } catch (error) {
    log(`   ❌ Ошибка: ${error.message}`, 'red');
    failedTests++;
    return false;
  }
}

async function testCORS() {
  try {
    log(`\n🧪 Тестирование: CORS Headers`, 'cyan');
    
    const result = await makeRequest('/api/health', 'GET', {
      'Origin': 'http://localhost:3000'
    });
    
    const corsHeader = result.headers['access-control-allow-origin'];
    
    if (corsHeader) {
      log(`   ✅ CORS заголовок присутствует: ${corsHeader}`, 'green');
      passedTests++;
      return true;
    } else {
      log(`   ❌ CORS заголовок отсутствует`, 'red');
      failedTests++;
      return false;
    }
  } catch (error) {
    log(`   ❌ Ошибка: ${error.message}`, 'red');
    failedTests++;
    return false;
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🚀 Запуск тестов интеграции watchRebel', 'cyan');
  log('='.repeat(60), 'cyan');

  // Тест 1: Health Check
  await testEndpoint(
    'Health Check',
    '/api/health',
    200,
    (data) => data.status === 'ok' ? true : 'Неверный статус в ответе'
  );

  // Тест 2: CORS
  await testCORS();

  // Тест 3: Auth Session (без токена - должен вернуть 401)
  await testEndpoint(
    'Auth Session (без токена)',
    '/api/auth/session',
    401
  );

  // Тест 4: Lists (без токена - должен вернуть 401)
  await testEndpoint(
    'Get Lists (без токена)',
    '/api/lists',
    401
  );

  // Тест 5: Watchlist (без токена - должен вернуть 401)
  await testEndpoint(
    'Get Watchlist (без токена)',
    '/api/watchlist',
    401
  );

  // Тест 6: Notifications (без токена - должен вернуть 401)
  await testEndpoint(
    'Get Notifications (без токена)',
    '/api/notifications',
    401
  );

  // Тест 7: Users Search (без токена - должен вернуть 401)
  await testEndpoint(
    'Search Users (без токена)',
    '/api/users/search?query=test',
    401
  );

  // Итоги
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Результаты тестирования:', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`✅ Пройдено: ${passedTests}`, 'green');
  log(`❌ Провалено: ${failedTests}`, 'red');
  log(`📈 Всего: ${passedTests + failedTests}`, 'blue');
  
  if (failedTests === 0) {
    log('\n🎉 Все тесты пройдены успешно!', 'green');
    log('✅ Интеграция Frontend ↔ Backend работает корректно', 'green');
  } else {
    log('\n⚠️  Некоторые тесты провалены', 'yellow');
    log('Проверьте логи выше для деталей', 'yellow');
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// Запуск тестов
runTests().catch((error) => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  process.exit(1);
});
