import { getDatabase } from './db.js';

/**
 * Выполнить все миграции базы данных
 */
export async function runMigrations() {
  const db = getDatabase();
  
  console.log('Запуск миграций базы данных...');
  
  return new Promise((resolve) => {
    // Выполняем все миграции в одной транзакции
    const migrations = `
      -- Таблица пользователей
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_username TEXT,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        theme TEXT DEFAULT 'light-cream',
        referral_code TEXT UNIQUE,
        referred_by TEXT,
        referrals_count INTEGER DEFAULT 0,
        ban_reason TEXT,
        post_ban_until DATETIME,
        auth_method TEXT DEFAULT 'telegram',
        email TEXT UNIQUE,
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT 0,
        google_id TEXT UNIQUE,
        discord_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Таблица сессий
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Таблица пользовательских списков
      CREATE TABLE IF NOT EXISTS custom_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Таблица элементов списков
      CREATE TABLE IF NOT EXISTS list_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES custom_lists(id) ON DELETE CASCADE,
        UNIQUE(list_id, tmdb_id)
      );

      -- Таблица списка желаемого
      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, tmdb_id)
      );

      -- Таблица оценок
      CREATE TABLE IF NOT EXISTS ratings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        media_type TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, tmdb_id)
      );

      -- Таблица постов на стене
      CREATE TABLE IF NOT EXISTS wall_posts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        content TEXT,
        tmdb_id INTEGER,
        media_type TEXT,
        rating INTEGER,
        image_urls TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edited_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Таблица реакций
      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id)
      );

      -- Таблица прогресса просмотра серий
      CREATE TABLE IF NOT EXISTS episode_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tmdb_id INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        episode_number INTEGER NOT NULL,
        watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, tmdb_id, season_number, episode_number)
      );

      -- Таблица друзей
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, friend_id)
      );

      -- Таблица запросов в друзья
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(from_user_id, to_user_id)
      );

      -- Индексы для friend_requests
      CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user_id ON friend_requests(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user_id ON friend_requests(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

      -- Таблица блокировок пользователей
      CREATE TABLE IF NOT EXISTS user_blocks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        blocked_user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, blocked_user_id)
      );

      -- Индексы для user_blocks
      CREATE INDEX IF NOT EXISTS idx_user_blocks_user_id ON user_blocks(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks(blocked_user_id);

      -- Таблица уведомлений
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        related_user_id TEXT,
        related_post_id TEXT,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Таблица объявлений
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        image_url TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Таблица изображений объявлений
      CREATE TABLE IF NOT EXISTS announcement_images (
        id TEXT PRIMARY KEY,
        announcement_id TEXT NOT NULL,
        image_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
      );

      -- Индекс для быстрого поиска изображений по announcement_id
      CREATE INDEX IF NOT EXISTS idx_announcement_images_announcement_id ON announcement_images(announcement_id);

      -- Таблица рефералов
      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        referred_id TEXT NOT NULL,
        referral_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(referrer_id, referred_id)
      );

      -- Таблица действий модерации
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        admin_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        reason TEXT,
        duration_minutes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES users(id)
      );

      -- Таблица настроек сайта
      CREATE TABLE IF NOT EXISTS site_settings (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );

      -- Таблица токенов подтверждения email
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Таблица токенов сброса пароля
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Добавляем начальную запись для контактов рекламы
      INSERT OR IGNORE INTO site_settings (id, key, value, updated_at)
      VALUES ('advertising_contacts', 'advertising_contacts', 'Для размещения рекламы свяжитесь с нами:\n\nEmail: admin@watchrebel.com\nTelegram: @watchrebel_admin', CURRENT_TIMESTAMP);

      -- Таблица диалогов (conversations)
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user1_id TEXT NOT NULL,
        user2_id TEXT NOT NULL,
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user1_id, user2_id)
      );

      -- Индекс для быстрого поиска диалогов пользователя
      CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);

      -- Таблица сообщений (messages)
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Индексы для оптимизации запросов
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

      -- Добавляем колонки для геометки и предложений медиа
      -- (проверяются отдельно ниже, чтобы не падать при дубликате)
      
      -- Таблица настроек уведомлений
      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        friend_added_to_list BOOLEAN DEFAULT 1,
        friend_rated_media BOOLEAN DEFAULT 1,
        friend_posted_review BOOLEAN DEFAULT 1,
        friend_reacted_to_post BOOLEAN DEFAULT 1,
        new_message BOOLEAN DEFAULT 1,
        new_friend_request BOOLEAN DEFAULT 1,
        admin_announcement BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Индекс для быстрого поиска настроек по user_id
      CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);

      -- Таблица жалоб
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL,
        reported_user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        reviewed_by TEXT,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
    `;

    db.exec(migrations, (err) => {
      if (err) {
        console.error('Ошибка при выполнении миграций:', err.message);
        resolve({ success: false, error: err.message });
      } else {
        console.log('✓ Все таблицы успешно созданы');
        console.log('Все миграции успешно выполнены!');
        
        // Безопасное добавление колонок (игнорируем если уже существуют)
        const safeAddColumn = (table, column, type, defaultVal) => {
          const defaultClause = defaultVal ? ` DEFAULT ${defaultVal}` : '';
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultClause}`, [], (err) => {
            if (err && !err.message.includes('duplicate column')) {
              console.error(`Ошибка добавления колонки ${table}.${column}:`, err.message);
            }
          });
        };

        safeAddColumn('messages', 'location', 'TEXT');
        safeAddColumn('messages', 'suggested_media', 'TEXT');
        safeAddColumn('messages', 'deleted_for_users', 'TEXT', "'[]'");
        safeAddColumn('messages', 'is_announcement', 'BOOLEAN', '0');
        safeAddColumn('users', 'last_feed_view', 'DATETIME');

        // === Упоминания в постах ===
        db.exec(`
          CREATE TABLE IF NOT EXISTS post_mentions (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            mentioned_user_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES wall_posts(id) ON DELETE CASCADE,
            FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_post_mentions_post ON post_mentions(post_id);
          CREATE INDEX IF NOT EXISTS idx_post_mentions_user ON post_mentions(mentioned_user_id);
        `, (err) => {
          if (err) {
            console.error('Ошибка создания таблицы post_mentions:', err.message);
          }
        });

        // === Групповые чаты ===
        safeAddColumn('conversations', 'is_group', 'BOOLEAN', '0');
        safeAddColumn('conversations', 'group_name', 'TEXT');
        safeAddColumn('conversations', 'group_avatar', 'TEXT');
        safeAddColumn('conversations', 'created_by', 'TEXT');

        db.exec(`
          -- Участники групповых чатов
          CREATE TABLE IF NOT EXISTS conversation_members (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            left_at DATETIME,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(conversation_id, user_id)
          );
          CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);
          CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);

          -- Модераторы групповых чатов
          CREATE TABLE IF NOT EXISTS group_moderators (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            assigned_by TEXT NOT NULL,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_by) REFERENCES users(id),
            UNIQUE(conversation_id, user_id)
          );

          -- Права модераторов групповых чатов
          CREATE TABLE IF NOT EXISTS group_moderator_permissions (
            id TEXT PRIMARY KEY,
            moderator_id TEXT NOT NULL,
            permission_type TEXT NOT NULL,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (moderator_id) REFERENCES group_moderators(id) ON DELETE CASCADE,
            UNIQUE(moderator_id, permission_type)
          );
        `, (err) => {
          if (err) {
            console.error('Ошибка создания таблиц групповых чатов:', err.message);
          } else {
            console.log('✓ Таблицы групповых чатов созданы');
          }
        });

        // Таблица рекламных постов
        db.run(`
          CREATE TABLE IF NOT EXISTS advertising_posts (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            link_url TEXT,
            link_label TEXT,
            image_urls TEXT DEFAULT '[]',
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
          );
        `, (err) => {
          if (err) {
            console.error('Ошибка создания таблицы advertising_posts:', err.message);
          } else {
            console.log('✓ Таблица advertising_posts создана');
          }
        });

        // Таблица заявок на рекламу
        db.run(`
          CREATE TABLE IF NOT EXISTS ad_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT NOT NULL,
            telegram TEXT NOT NULL,
            extra_contact TEXT,
            channel_site INTEGER DEFAULT 0,
            channel_tg INTEGER DEFAULT 0,
            site_pin_qty INTEGER DEFAULT 0,
            site_repeat_qty INTEGER DEFAULT 0,
            site_interval INTEGER DEFAULT 0,
            tg_mailing_qty INTEGER DEFAULT 0,
            tg_repeat_qty INTEGER DEFAULT 0,
            tg_interval INTEGER DEFAULT 0,
            auto_delete_off INTEGER DEFAULT 0,
            total_cost INTEGER DEFAULT 0,
            currency TEXT DEFAULT 'RUB',
            ad_description TEXT,
            ad_link TEXT,
            ad_link_label TEXT,
            ad_text TEXT,
            image_url TEXT,
            is_archived INTEGER DEFAULT 0,
            scheduled_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
        `, (err) => {
          if (err) {
            console.error('Ошибка создания таблицы ad_requests:', err.message);
          } else {
            console.log('✓ Таблица ad_requests создана');
          }
        });

        // Добавляем is_archived если его нет (для существующих БД)
        db.run(`ALTER TABLE ad_requests ADD COLUMN is_archived INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Ошибка добавления is_archived:', err.message);
          }
        });

        // Добавляем scheduled_at если его нет
        db.run(`ALTER TABLE ad_requests ADD COLUMN scheduled_at TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Ошибка добавления scheduled_at:', err.message);
          }
        });

        // Добавляем ad_link_label если его нет
        db.run(`ALTER TABLE ad_requests ADD COLUMN ad_link_label TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Ошибка добавления ad_link_label:', err.message);
          }
        });

        // Запускаем миграцию шаблонов уведомлений (убираем встроенные имена)
        import('./migrations/update-notification-content-templates.js')
          .then(module => module.updateNotificationContentTemplates())
          .catch(err => console.error('Ошибка миграции шаблонов уведомлений:', err));

        resolve({ success: true });
      }
    });
  });
}

export default { runMigrations };
