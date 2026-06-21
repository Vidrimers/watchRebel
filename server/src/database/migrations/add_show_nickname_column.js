import { getDatabase } from '../db.js';

export async function addShowNicknameColumn() {
  console.log('🔄 Добавление поля show_nickname в таблицу users...');
  
  try {
    const db = getDatabase();
    
    await new Promise((resolve, reject) => {
      db.run('ALTER TABLE users ADD COLUMN show_nickname BOOLEAN DEFAULT 0', (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('ℹ️ Поле show_nickname уже существует');
            resolve();
          } else {
            reject(err);
          }
        } else {
          console.log('✅ Поле show_nickname добавлено');
          resolve();
        }
      });
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Ошибка добавления show_nickname:', error);
    return { success: false, error: error.message };
  }
}
