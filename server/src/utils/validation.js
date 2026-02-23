import validator from 'validator';
import dns from 'dns-lookup-promise';
import zxcvbn from 'zxcvbn';

/**
 * Валидация email адреса
 * @param {string} email - Email для проверки
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email обязателен' };
  }

  // Проверка формата email
  if (!validator.isEmail(email)) {
    return { valid: false, error: 'Неверный формат email' };
  }

  // Проверка длины
  if (email.length > 254) {
    return { valid: false, error: 'Email слишком длинный' };
  }

  // Нормализация email (приведение к нижнему регистру, удаление пробелов)
  const normalizedEmail = validator.normalizeEmail(email, {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false
  });

  return { valid: true, error: null, normalizedEmail };
}

/**
 * Проверка существования домена email (DNS lookup)
 * @param {string} email - Email для проверки
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function validateEmailDomain(email) {
  try {
    const domain = email.split('@')[1];
    
    if (!domain) {
      return { valid: false, error: 'Неверный формат email' };
    }

    // Проверяем MX записи домена
    const mxRecords = await dns.resolveMx(domain);
    
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, error: 'Домен email не существует или не принимает почту' };
    }

    return { valid: true, error: null };
  } catch (error) {
    // Если домен не найден или ошибка DNS
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return { valid: false, error: 'Домен email не существует' };
    }
    
    // Для других ошибок (например, timeout) - пропускаем проверку
    console.warn('Ошибка проверки домена email:', error.message);
    return { valid: true, error: null };
  }
}

/**
 * Валидация пароля с проверкой сложности
 * @param {string} password - Пароль для проверки
 * @param {string} userInputs - Дополнительные данные пользователя для проверки (email, имя)
 * @returns {{valid: boolean, error: string|null, score: number, feedback: object}}
 */
export function validatePassword(password, userInputs = []) {
  if (!password || typeof password !== 'string') {
    return { 
      valid: false, 
      error: 'Пароль обязателен',
      score: 0,
      feedback: {}
    };
  }

  // Минимальная длина
  if (password.length < 8) {
    return { 
      valid: false, 
      error: 'Пароль должен содержать минимум 8 символов',
      score: 0,
      feedback: {}
    };
  }

  // Максимальная длина
  if (password.length > 128) {
    return { 
      valid: false, 
      error: 'Пароль слишком длинный (максимум 128 символов)',
      score: 0,
      feedback: {}
    };
  }

  // Проверка сложности пароля с помощью zxcvbn
  const result = zxcvbn(password, userInputs);

  // Оценка от 0 до 4:
  // 0 - слишком простой
  // 1 - слабый
  // 2 - средний
  // 3 - сильный
  // 4 - очень сильный

  if (result.score < 2) {
    let errorMessage = 'Пароль слишком слабый. ';
    
    if (result.feedback.warning) {
      errorMessage += result.feedback.warning + '. ';
    }
    
    if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
      errorMessage += result.feedback.suggestions.join('. ');
    }

    return {
      valid: false,
      error: errorMessage,
      score: result.score,
      feedback: result.feedback
    };
  }

  return {
    valid: true,
    error: null,
    score: result.score,
    feedback: result.feedback
  };
}

/**
 * Валидация имени пользователя
 * @param {string} displayName - Имя для проверки
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateDisplayName(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    return { valid: false, error: 'Имя обязательно' };
  }

  // Удаляем пробелы по краям
  const trimmedName = displayName.trim();

  // Минимальная длина
  if (trimmedName.length < 2) {
    return { valid: false, error: 'Имя должно содержать минимум 2 символа' };
  }

  // Максимальная длина
  if (trimmedName.length > 50) {
    return { valid: false, error: 'Имя слишком длинное (максимум 50 символов)' };
  }

  // Проверка на недопустимые символы (только буквы, цифры, пробелы, дефисы, подчеркивания)
  const nameRegex = /^[a-zA-Zа-яА-ЯёЁ0-9\s\-_]+$/;
  if (!nameRegex.test(trimmedName)) {
    return { valid: false, error: 'Имя содержит недопустимые символы' };
  }

  return { valid: true, error: null, sanitizedName: trimmedName };
}

/**
 * Санитизация строки (удаление потенциально опасных символов)
 * @param {string} input - Строка для санитизации
 * @returns {string} - Санитизированная строка
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Удаляем HTML теги
  let sanitized = validator.stripLow(input);
  
  // Экранируем HTML специальные символы
  sanitized = validator.escape(sanitized);
  
  // Удаляем пробелы по краям
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Валидация URL
 * @param {string} url - URL для проверки
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL обязателен' };
  }

  if (!validator.isURL(url, { 
    protocols: ['http', 'https'],
    require_protocol: true 
  })) {
    return { valid: false, error: 'Неверный формат URL' };
  }

  return { valid: true, error: null };
}

/**
 * Защита от SQL injection (проверка на подозрительные паттерны)
 * Примечание: Основная защита - использование параметризованных запросов
 * @param {string} input - Строка для проверки
 * @returns {{safe: boolean, warning: string|null}}
 */
export function checkSqlInjection(input) {
  if (!input || typeof input !== 'string') {
    return { safe: true, warning: null };
  }

  // Паттерны SQL injection
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|;|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /(UNION.*SELECT)/i,
    /(CONCAT\()/i
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return { 
        safe: false, 
        warning: 'Обнаружены подозрительные символы или SQL команды' 
      };
    }
  }

  return { safe: true, warning: null };
}
