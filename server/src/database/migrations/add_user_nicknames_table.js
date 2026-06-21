import { executeQuery } from '../db.js';

export async function addUserNicknamesTable() {
  console.log('🔄 Создание таблицы user_nicknames...');
  
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_nicknames (
        id TEXT PRIMARY KEY,
        set_by_user_id TEXT NOT NULL,
        target_user_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (set_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(set_by_user_id, target_user_id)
      )
    `);

    await executeQuery('CREATE INDEX IF NOT EXISTS idx_nicknames_target ON user_nicknames(target_user_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_nicknames_set_by ON user_nicknames(set_by_user_id)');

    console.log('✅ Таблица user_nicknames создана');
  } catch (error) {
    if (error.message && error.message.includes('duplicate column')) {
      console.log('ℹ️ Таблица user_nicknames уже существует');
    } else {
      console.error('❌ Ошибка создания user_nicknames:', error);
    }
  }
}
