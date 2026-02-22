import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { executeQuery } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Генерация уникального реферального кода
 */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Настройка Google OAuth Strategy
 */
export function configurePassport() {
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:1313/api/auth/google/callback',
          scope: ['profile', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            console.log('📥 Google OAuth profile:', profile);

            const googleId = profile.id;
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const displayName = profile.displayName || profile.name?.givenName || 'Google User';
            const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            // Проверяем, существует ли пользователь с таким google_id
            const userCheck = await executeQuery(
              'SELECT * FROM users WHERE google_id = ?',
              [googleId]
            );

            if (!userCheck.success) {
              return done(new Error('Ошибка проверки пользователя'));
            }

            let user;

            if (userCheck.data.length === 0) {
              // Проверяем, есть ли пользователь с таким email
              if (email) {
                const emailCheck = await executeQuery(
                  'SELECT * FROM users WHERE email = ?',
                  [email.toLowerCase()]
                );

                if (emailCheck.success && emailCheck.data.length > 0) {
                  // Пользователь с таким email уже существует
                  // Привязываем Google аккаунт к существующему пользователю
                  user = emailCheck.data[0];
                  
                  await executeQuery(
                    'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [googleId, user.id]
                  );

                  console.log(`✅ Google аккаунт привязан к существующему пользователю: ${user.display_name}`);
                  return done(null, user);
                }
              }

              // Создаем нового пользователя
              const userId = uuidv4();
              
              // Генерируем уникальный реферальный код
              let referralCode;
              let isUnique = false;
              
              while (!isUnique) {
                referralCode = generateReferralCode();
                const codeCheck = await executeQuery(
                  'SELECT id FROM users WHERE referral_code = ?',
                  [referralCode]
                );
                if (codeCheck.success && codeCheck.data.length === 0) {
                  isUnique = true;
                }
              }

              const insertResult = await executeQuery(
                `INSERT INTO users (
                  id, 
                  google_id, 
                  email, 
                  display_name, 
                  avatar_url, 
                  auth_method, 
                  email_verified, 
                  theme, 
                  referral_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userId,
                  googleId,
                  email ? email.toLowerCase() : null,
                  displayName,
                  avatarUrl,
                  'google',
                  1, // Google email всегда подтвержден
                  'light-cream',
                  referralCode
                ]
              );

              if (!insertResult.success) {
                return done(new Error('Ошибка создания пользователя'));
              }

              // Получаем созданного пользователя
              const newUserResult = await executeQuery(
                'SELECT * FROM users WHERE id = ?',
                [userId]
              );

              user = newUserResult.data[0];
              console.log(`✅ Новый пользователь создан через Google: ${displayName}`);
            } else {
              user = userCheck.data[0];
              console.log(`✅ Пользователь найден через Google: ${user.display_name}`);

              // Проверяем, не заблокирован ли пользователь
              if (user.is_blocked) {
                return done(new Error('Пользователь заблокирован'));
              }

              // Обновляем информацию пользователя
              await executeQuery(
                `UPDATE users 
                 SET display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [displayName, avatarUrl || user.avatar_url, user.id]
              );
            }

            return done(null, user);
          } catch (error) {
            console.error('❌ Ошибка Google OAuth:', error);
            return done(error);
          }
        }
      )
    );
  } else {
    console.warn('⚠️ Google OAuth не настроен: отсутствуют GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET');
  }

  // Discord OAuth Strategy
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:1313/api/auth/discord/callback',
          scope: ['identify', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            console.log('📥 Discord OAuth profile:', profile);

            const discordId = profile.id;
            const email = profile.email || null;
            const username = profile.username || 'Discord User';
            const discriminator = profile.discriminator;
            const displayName = discriminator && discriminator !== '0' 
              ? `${username}#${discriminator}` 
              : username;
            const avatarUrl = profile.avatar 
              ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` 
              : null;

            // Проверяем, существует ли пользователь с таким discord_id
            const userCheck = await executeQuery(
              'SELECT * FROM users WHERE discord_id = ?',
              [discordId]
            );

            if (!userCheck.success) {
              return done(new Error('Ошибка проверки пользователя'));
            }

            let user;

            if (userCheck.data.length === 0) {
              // Проверяем, есть ли пользователь с таким email
              if (email) {
                const emailCheck = await executeQuery(
                  'SELECT * FROM users WHERE email = ?',
                  [email.toLowerCase()]
                );

                if (emailCheck.success && emailCheck.data.length > 0) {
                  // Пользователь с таким email уже существует
                  // Привязываем Discord аккаунт к существующему пользователю
                  user = emailCheck.data[0];
                  
                  await executeQuery(
                    'UPDATE users SET discord_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [discordId, user.id]
                  );

                  console.log(`✅ Discord аккаунт привязан к существующему пользователю: ${user.display_name}`);
                  return done(null, user);
                }
              }

              // Создаем нового пользователя
              const userId = uuidv4();
              
              // Генерируем уникальный реферальный код
              let referralCode;
              let isUnique = false;
              
              while (!isUnique) {
                referralCode = generateReferralCode();
                const codeCheck = await executeQuery(
                  'SELECT id FROM users WHERE referral_code = ?',
                  [referralCode]
                );
                if (codeCheck.success && codeCheck.data.length === 0) {
                  isUnique = true;
                }
              }

              const insertResult = await executeQuery(
                `INSERT INTO users (
                  id, 
                  discord_id, 
                  email, 
                  display_name, 
                  avatar_url, 
                  auth_method, 
                  email_verified, 
                  theme, 
                  referral_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userId,
                  discordId,
                  email ? email.toLowerCase() : null,
                  displayName,
                  avatarUrl,
                  'discord',
                  email ? 1 : 0, // Discord email считается подтвержденным, если предоставлен
                  'light-cream',
                  referralCode
                ]
              );

              if (!insertResult.success) {
                return done(new Error('Ошибка создания пользователя'));
              }

              // Получаем созданного пользователя
              const newUserResult = await executeQuery(
                'SELECT * FROM users WHERE id = ?',
                [userId]
              );

              user = newUserResult.data[0];
              console.log(`✅ Новый пользователь создан через Discord: ${displayName}`);
            } else {
              user = userCheck.data[0];
              console.log(`✅ Пользователь найден через Discord: ${user.display_name}`);

              // Проверяем, не заблокирован ли пользователь
              if (user.is_blocked) {
                return done(new Error('Пользователь заблокирован'));
              }

              // Обновляем информацию пользователя
              await executeQuery(
                `UPDATE users 
                 SET display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [displayName, avatarUrl || user.avatar_url, user.id]
              );
            }

            return done(null, user);
          } catch (error) {
            console.error('❌ Ошибка Discord OAuth:', error);
            return done(error);
          }
        }
      )
    );
  } else {
    console.warn('⚠️ Discord OAuth не настроен: отсутствуют DISCORD_CLIENT_ID или DISCORD_CLIENT_SECRET');
  }

  // Сериализация пользователя для сессии
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Десериализация пользователя из сессии
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await executeQuery('SELECT * FROM users WHERE id = ?', [id]);
      if (result.success && result.data.length > 0) {
        done(null, result.data[0]);
      } else {
        done(new Error('Пользователь не найден'));
      }
    } catch (error) {
      done(error);
    }
  });
}

export default passport;
