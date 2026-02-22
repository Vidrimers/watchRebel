import { getDatabase } from '../src/database/db.js';

/**
 * Скрипт для тестирования множественных способов входа
 * Проверяет наличие всех необходимых полей и функциональность
 */
async function testAuthMethods() {
  const db = getDatabase();
  
  console.log('🧪 Начинаем тестирование множественных способов входа...\n');
  
  const tests = [];
  
  // Тест 1: Проверка структуры таблицы users
  console.log('📋 Тест 1: Проверка структуры таблицы users');
  const tableInfo = await new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(users)', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  const requiredFields = [
    'auth_method',
    'email',
    'password_hash',
    'google_id',
    'discord_id',
    'email_verified'
  ];
  
  const existingFields = tableInfo.map(row => row.name);
  const missingFields = requiredFields.filter(field => !existingFields.includes(field));
  
  if (missingFields.length === 0) {
    console.log('✅ Все необходимые поля присутствуют в таблице users');
    tests.push({ name: 'Структура таблицы users', passed: true });
  } else {
    console.log(`❌ Отсутствуют поля: ${missingFields.join(', ')}`);
    tests.push({ name: 'Структура таблицы users', passed: false, error: `Отсутствуют поля: ${missingFields.join(', ')}` });
  }
  
  // Тест 2: Проверка таблицы email_verification_tokens
  console.log('\n📋 Тест 2: Проверка таблицы email_verification_tokens');
  const tableExists = await new Promise((resolve) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification_tokens'",
      [],
      (err, row) => {
        resolve(!!row);
      }
    );
  });
  
  if (tableExists) {
    console.log('✅ Таблица email_verification_tokens существует');
    tests.push({ name: 'Таблица email_verification_tokens', passed: true });
  } else {
    console.log('❌ Таблица email_verification_tokens не найдена');
    tests.push({ name: 'Таблица email_verification_tokens', passed: false, error: 'Таблица не найдена' });
  }
  
  // Тест 3: Проверка индексов
  console.log('\n📋 Тест 3: Проверка индексов');
  const indexes = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  const requiredIndexes = ['idx_users_email', 'idx_users_google_id', 'idx_users_discord_id'];
  const existingIndexes = indexes.map(row => row.name);
  const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));
  
  if (missingIndexes.length === 0) {
    console.log('✅ Все необходимые индексы созданы');
    tests.push({ name: 'Индексы', passed: true });
  } else {
    console.log(`⚠️  Отсутствуют индексы: ${missingIndexes.join(', ')}`);
    tests.push({ name: 'Индексы', passed: false, error: `Отсутствуют индексы: ${missingIndexes.join(', ')}` });
  }
  
  // Тест 4: Проверка существующих пользователей
  console.log('\n📋 Тест 4: Проверка auth_method у существующих пользователей');
  const usersStats = await new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        auth_method,
        COUNT(*) as count
       FROM users
       GROUP BY auth_method`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
  
  console.log('📊 Статистика пользователей по способам входа:');
  usersStats.forEach(stat => {
    console.log(`   - ${stat.auth_method || 'NULL'}: ${stat.count} пользователей`);
  });
  
  const usersWithNull = usersStats.find(s => s.auth_method === null);
  if (!usersWithNull) {
    console.log('✅ Все пользователи имеют auth_method');
    tests.push({ name: 'Auth method у пользователей', passed: true });
  } else {
    console.log(`❌ ${usersWithNull.count} пользователей имеют NULL auth_method`);
    tests.push({ name: 'Auth method у пользователей', passed: false, error: `${usersWithNull.count} пользователей с NULL` });
  }
  
  // Тест 5: Проверка целостности данных
  console.log('\n📋 Тест 5: Проверка целостности данных');
  const integrityChecks = await new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN auth_method = 'telegram' AND telegram_username IS NULL THEN 1 ELSE 0 END) as telegram_without_username,
        SUM(CASE WHEN auth_method = 'email' AND email IS NULL THEN 1 ELSE 0 END) as email_without_email,
        SUM(CASE WHEN auth_method = 'google' AND google_id IS NULL THEN 1 ELSE 0 END) as google_without_id,
        SUM(CASE WHEN auth_method = 'discord' AND discord_id IS NULL THEN 1 ELSE 0 END) as discord_without_id
       FROM users`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      }
    );
  });
  
  const issues = [];
  if (integrityChecks.telegram_without_username > 0) {
    issues.push(`${integrityChecks.telegram_without_username} Telegram пользователей без username`);
  }
  if (integrityChecks.email_without_email > 0) {
    issues.push(`${integrityChecks.email_without_email} Email пользователей без email`);
  }
  if (integrityChecks.google_without_id > 0) {
    issues.push(`${integrityChecks.google_without_id} Google пользователей без google_id`);
  }
  if (integrityChecks.discord_without_id > 0) {
    issues.push(`${integrityChecks.discord_without_id} Discord пользователей без discord_id`);
  }
  
  if (issues.length === 0) {
    console.log('✅ Целостность данных в порядке');
    tests.push({ name: 'Целостность данных', passed: true });
  } else {
    console.log('⚠️  Обнаружены проблемы с целостностью:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    tests.push({ name: 'Целостность данных', passed: false, error: issues.join('; ') });
  }
  
  // Итоговый отчет
  console.log('\n' + '='.repeat(60));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(60));
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  
  console.log(`\n✅ Пройдено тестов: ${passed}/${tests.length}`);
  if (failed > 0) {
    console.log(`❌ Провалено тестов: ${failed}/${tests.length}\n`);
    console.log('Провалившиеся тесты:');
    tests.filter(t => !t.passed).forEach(test => {
      console.log(`   - ${test.name}: ${test.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('✅ Все тесты пройдены успешно!');
    return { success: true, passed, failed };
  } else {
    console.log('⚠️  Некоторые тесты провалились. Проверьте ошибки выше.');
    return { success: false, passed, failed };
  }
}

// Запускаем тесты
testAuthMethods()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка при выполнении тестов:', error);
    process.exit(1);
  });
