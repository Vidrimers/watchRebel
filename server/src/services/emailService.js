import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Сервис для отправки email уведомлений
 */

// Создаем транспорт для отправки писем
let transporter = null;

/**
 * Инициализация транспорта для отправки email
 */
function initTransporter() {
  if (transporter) {
    return transporter;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('⚠️ SMTP настройки не найдены в .env файле. Email отправка отключена.');
    console.warn('Добавьте SMTP_HOST, SMTP_USER, SMTP_PASS в .env для включения email отправки.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true для 465, false для других портов
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  console.log('✅ Email транспорт инициализирован');
  return transporter;
}

/**
 * Отправить письмо с подтверждением email
 * @param {string} email - Email получателя
 * @param {string} displayName - Имя пользователя
 * @param {string} verificationToken - Токен подтверждения
 */
export async function sendVerificationEmail(email, displayName, verificationToken) {
  const transport = initTransporter();
  
  if (!transport) {
    console.warn('⚠️ Email транспорт не инициализирован. Письмо не отправлено.');
    return { success: false, error: 'Email транспорт не настроен' };
  }

  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  const verificationUrl = `${publicUrl}/verify-email/${verificationToken}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Подтверждение регистрации на watchRebel',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎬 watchRebel</h1>
          <p>Социальная сеть для любителей кино и сериалов</p>
        </div>
        <div class="content">
          <h2>Привет, ${displayName}!</h2>
          <p>Спасибо за регистрацию на watchRebel! Для завершения регистрации, пожалуйста, подтвердите свой email адрес.</p>
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Подтвердить Email</a>
          </p>
          <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
            ${verificationUrl}
          </p>
          <p><strong>Важно:</strong> Ссылка действительна в течение 24 часов.</p>
          <p>Если вы не регистрировались на watchRebel, просто проигнорируйте это письмо.</p>
        </div>
        <div class="footer">
          <p>© 2024 watchRebel. Все права защищены.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Привет, ${displayName}!
      
      Спасибо за регистрацию на watchRebel! Для завершения регистрации, пожалуйста, подтвердите свой email адрес.
      
      Перейдите по ссылке: ${verificationUrl}
      
      Ссылка действительна в течение 24 часов.
      
      Если вы не регистрировались на watchRebel, просто проигнорируйте это письмо.
      
      © 2024 watchRebel
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Письмо с подтверждением отправлено:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Ошибка отправки письма:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить письмо для сброса пароля
 * @param {string} email - Email получателя
 * @param {string} displayName - Имя пользователя
 * @param {string} resetToken - Токен сброса пароля
 */
export async function sendPasswordResetEmail(email, displayName, resetToken) {
  const transport = initTransporter();
  
  if (!transport) {
    console.warn('⚠️ Email транспорт не инициализирован. Письмо не отправлено.');
    return { success: false, error: 'Email транспорт не настроен' };
  }

  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  const resetUrl = `${publicUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Сброс пароля на watchRebel',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎬 watchRebel</h1>
          <p>Социальная сеть для любителей кино и сериалов</p>
        </div>
        <div class="content">
          <h2>Привет, ${displayName}!</h2>
          <p>Мы получили запрос на сброс пароля для вашего аккаунта на watchRebel.</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Сбросить пароль</a>
          </p>
          <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
            ${resetUrl}
          </p>
          <div class="warning">
            <strong>⚠️ Важно:</strong>
            <ul>
              <li>Ссылка действительна в течение 1 часа</li>
              <li>Если вы не запрашивали сброс пароля, проигнорируйте это письмо</li>
              <li>Ваш пароль останется без изменений</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>© 2024 watchRebel. Все права защищены.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Привет, ${displayName}!
      
      Мы получили запрос на сброс пароля для вашего аккаунта на watchRebel.
      
      Перейдите по ссылке для сброса пароля: ${resetUrl}
      
      Ссылка действительна в течение 1 часа.
      
      Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо. Ваш пароль останется без изменений.
      
      © 2024 watchRebel
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('✅ Письмо для сброса пароля отправлено:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Ошибка отправки письма:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
