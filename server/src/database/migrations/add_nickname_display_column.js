import { getDatabase } from '../db.js';

export async function addNicknameDisplayColumn() {
  console.log('🔄 Добавление поля nickname_display в таблицу users...');
  
  try {
    const db = getDatabase();
    
    await new Promise((resolve, reject) => {
      db.run('ALTER TABLE users ADD COLUMN nickname_display TEXT DEFAULT "name"', (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('ℹ️ Поле nickname_display уже существует');
            resolve();
          } else {
            reject(err);
          }
        } else {
          console.log('✅ Поле nickname_display добавлено');
          resolve();
        }
      });
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка добавления nickname_display:', error);
    return { success: false, error: error.message };
  }
}
