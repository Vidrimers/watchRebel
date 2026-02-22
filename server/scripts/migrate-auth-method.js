import { getDatabase } from '../src/database/db.js';

/**
 * Скрипт для миграции существующих пользователей
 * Устанавливает auth_method = 'telegram' для всех пользователей, у которых это поле NULL
 */
async function migrateAuthMethod() {
  const db = getDatabase();
  
  console.log('🔄 Начинаем миграцию существующих пользователей...');
  
  return new Promise((resolve, reject) => {
    // Сначала проверяем, сколько пользователей нужно обновить
    db.get(
      'SELECT COUNT(*) as count FROM users WHERE auth_method IS NULL',
      [],
      (err, row) => {
        if (err) {
          console.error('❌ Ошибка при подсчете пользователей:', err);
          reject(err);
          return;
        }

        const usersToUpdate = row.count;
        console.log(`📊 Найдено пользователей для обновления: ${usersToUpdate}`);

        if (usersToUpdate === 0) {
          console.log('✅ Все пользователи уже имеют auth_method');
          resolve({ success: true, updated: 0 });
          return;
        }

        // Обновляем всех пользователей с NULL auth_method
        db.run(
          `UPDATE users 
           SET auth_method = 'telegram' 
           WHERE auth_method IS NULL`,
          [],
          function(err) {
            if (err) {
              console.error('❌ Ошибка при обновлении пользователей:', err);
              reject(err);
              return;
            }

            console.log(`✅ Успешно обновлено пользователей: ${this.changes}`);
            
            // Проверяем целостность данных
            db.get(
              'SELECT COUNT(*) as count FROM users WHERE auth_method IS NULL',
              [],
              (err, row) => {
                if (err) {
                  console.error('❌ Ошибка при проверке целостности:', err);
                  reject(err);
                  return;
                }

                if (row.count > 0) {
                  console.warn(`⚠️  Внимание: ${row.count} пользователей все еще имеют NULL auth_method`);
                } else {
                  console.log('✅ Проверка целостности пройдена: все пользователи имеют auth_method');
                }

                resolve({ 
                  success: true, 
                  updated: this.changes,
                  remaining: row.count 
                });
              }
            );
          }
        );
      }
    );
  });
}

// Запускаем миграцию
migrateAuthMethod()
  .then((result) => {
    console.log('\n📋 Результаты миграции:');
    console.log(`   - Обновлено пользователей: ${result.updated}`);
    console.log(`   - Осталось с NULL: ${result.remaining || 0}`);
    console.log('\n✅ Миграция завершена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Миграция завершилась с ошибкой:', error);
    process.exit(1);
  });
