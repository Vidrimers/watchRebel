/**
 * Сервис для отправки email уведомлений через Resend HTTP API
 * (SMTP заблокирован файрволом VDSina, используется HTTP API)
 * 
 * Переменные окружения загружаются в index.js (.env.production в продакшене)
 */

const RESEND_API_KEY = process.env.SMTP_PASS;
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = process.env.SMTP_FROM || 'watchRebel <noreply@watchrebel.ru>';

async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.warn('⚠️ RESEND API ключ не найден (SMTP_PASS). Email отправка отключена.');
    return { success: false, error: 'API ключ не настроен' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Resend API ошибка:', data);
      return { success: false, error: data.message || JSON.stringify(data) };
    }

    console.log('✅ Письмо отправлено:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('❌ Ошибка отправки письма:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Отправить письмо с подтверждением email
 */
export async function sendVerificationEmail(email, displayName, verificationToken) {
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  const verificationUrl = `${publicUrl}/verify-email/${verificationToken}`;

  return sendEmail({
    to: email,
    subject: 'Подтверждение регистрации на watchRebel',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
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
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
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
      
      Спасибо за регистрацию на watchRebel! Для завершения регистрации подтвердите свой email адрес.
      
      Перейдите по ссылке: ${verificationUrl}
      
      Ссылка действительна в течение 24 часов.
      
      © 2024 watchRebel
    `,
  });
}

/**
 * Отправить письмо для сброса пароля
 */
export async function sendPasswordResetEmail(email, displayName, resetToken) {
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  const resetUrl = `${publicUrl}/reset-password/${resetToken}`;

  return sendEmail({
    to: email,
    subject: 'Сброс пароля на watchRebel',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
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
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">${resetUrl}</p>
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
      
      Мы получили запрос на сброс пароля для вашего аккаунта.
      
      Перейдите по ссылке: ${resetUrl}
      
      Ссылка действительна в течение 1 часа.
      
      © 2024 watchRebel
    `,
  });
}

/**
 * Отправить код подтверждения для привязки email
 */
export async function sendLinkVerificationEmail(email, displayName, code) {
  return sendEmail({
    to: email,
    subject: 'Код подтверждения email — watchRebel',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; color: #667eea; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎬 watchRebel</h1>
          <p>Социальная сеть для любителей кино и сериалов</p>
        </div>
        <div class="content">
          <h2>Привет, ${displayName}!</h2>
          <p>Вы запросили привязку email к аккаунту на watchRebel.</p>
          <p>Ваш код подтверждения:</p>
          <div class="code">${code}</div>
          <p><strong>Важно:</strong> Код действителен в течение 15 минут.</p>
          <p>Если вы не запрашивали привязку email, просто проигнорируйте это письмо.</p>
        </div>
        <div class="footer">
          <p>© 2024 watchRebel. Все права защищены.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Привет, ${displayName}!
      
      Ваш код подтверждения: ${code}
      
      Код действителен в течение 15 минут.
      
      © 2024 watchRebel
    `,
  });
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
