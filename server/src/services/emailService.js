/**
 * Сервис для отправки email уведомлений через Resend HTTP API
 * (SMTP заблокирован файрволом VDSina, используется HTTP API)
 * 
 * Переменные окружения загружаются в index.js (.env.production в продакшене)
 * Читаем их лениво — при вызове sendEmail, а не при загрузке модуля
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || 'watchRebel <noreply@watchrebel.ru>';
  
  if (!apiKey) {
    console.warn('⚠️ RESEND API ключ не найден (SMTP_PASS). Email отправка отключена.');
    return { success: false, error: 'API ключ не настроен' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
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

/**
 * Общий HTML-шаблон для email-уведомлений
 */
function notificationTemplate({ title, content, buttonText, buttonUrl, footerText }) {
  const buttonHtml = buttonText && buttonUrl
    ? `<p style="text-align:center;"><a href="${buttonUrl}" style="display:inline-block;padding:12px 28px;background:#667eea;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">${buttonText}</a></p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:24px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="margin:0;font-size:22px;">🎬 watchRebel</h1>
      </div>
      <div style="background:#f9f9f9;padding:28px;border-radius:0 0 10px 10px;">
        <h2 style="margin-top:0;">${title}</h2>
        <p>${content}</p>
        ${buttonHtml}
        <p style="color:#999;font-size:12px;margin-top:24px;">${footerText || '© 2026 watchRebel. Все права защищены.'}</p>
      </div>
    </body>
    </html>`;
}

/**
 * Отправить email-уведомление о реакции на пост
 */
export async function sendReactionEmail({ toEmail, displayName, actorName, postUrl }) {
  if (!toEmail) return { success: false, error: 'Email не указан' };
  return sendEmail({
    to: toEmail,
    subject: `${actorName} отреагировал на ваш пост — watchRebel`,
    html: notificationTemplate({
      title: 'Новая реакция на вашем посте',
      content: `<strong>${actorName}</strong> поставил реакцию на ваш пост.`,
      buttonText: 'Посмотреть',
      buttonUrl: postUrl,
    }),
  });
}

/**
 * Отправить email-уведомление о комментарии к посту
 */
export async function sendCommentEmail({ toEmail, displayName, actorName, postUrl, commentPreview }) {
  if (!toEmail) return { success: false, error: 'Email не указан' };
  return sendEmail({
    to: toEmail,
    subject: `${actorName} прокомментировал ваш пост — watchRebel`,
    html: notificationTemplate({
      title: 'Новый комментарий к вашему посту',
      content: `<strong>${actorName}</strong> написал: <em>"${commentPreview || ''}"</em>`,
      buttonText: 'Ответить',
      buttonUrl: postUrl,
    }),
  });
}

/**
 * Отправить email-уведомление о новом друге
 */
export async function sendNewFriendEmail({ toEmail, displayName, actorName, profileUrl }) {
  if (!toEmail) return { success: false, error: 'Email не указан' };
  return sendEmail({
    to: toEmail,
    subject: `${actorName} добавил вас в друзья — watchRebel`,
    html: notificationTemplate({
      title: 'Новый друг',
      content: `<strong>${actorName}</strong> добавил вас в друзья. Теперь вы можете видеть посты друг друга в ленте.`,
      buttonText: 'Перейти в профиль',
      buttonUrl: profileUrl,
    }),
  });
}

/**
 * Отправить приветственное письмо
 */
export async function sendWelcomeEmail({ toEmail, displayName }) {
  if (!toEmail) return { success: false, error: 'Email не указан' };
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  return sendEmail({
    to: toEmail,
    subject: 'Добро пожаловать в watchRebel! 🎬',
    html: notificationTemplate({
      title: `Добро пожаловать, ${displayName}!`,
      content: `
        Рады приветствовать вас на watchRebel — социальной сети для любителей кино и сериалов.
        <br><br>
        Вот что можно делать здесь:
        <ul style="padding-left:20px;">
          <li>Вести дневники просмотра фильмов и сериалов</li>
          <li>Писать рецензии и делиться мнением</li>
          <li>Находить единомышленников по вкусам</li>
          <li>Составлять списки и делиться рекомендациями</li>
        </ul>
      `,
      buttonText: 'Перейти на главную',
      buttonUrl: publicUrl,
    }),
  });
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReactionEmail,
  sendCommentEmail,
  sendNewFriendEmail,
  sendWelcomeEmail,
};
