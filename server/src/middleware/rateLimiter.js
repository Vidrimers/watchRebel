import rateLimit from 'express-rate-limit';

/**
 * Rate limiter для защиты от брутфорса на endpoint входа через email
 * Ограничение: 5 попыток за 15 минут с одного IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // Максимум 5 запросов
  message: {
    error: 'Слишком много попыток входа. Пожалуйста, попробуйте позже.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: '15 минут'
  },
  standardHeaders: true, // Возвращать информацию о лимите в заголовках `RateLimit-*`
  legacyHeaders: false, // Отключить заголовки `X-RateLimit-*`
  // Пропускать успешные запросы (не считать их в лимите)
  skipSuccessfulRequests: true,
  // Обработчик при превышении лимита
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много попыток входа. Пожалуйста, попробуйте позже.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: '15 минут'
    });
  }
});

/**
 * Rate limiter для регистрации через email
 * Ограничение: 3 регистрации за час с одного IP
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // Максимум 3 регистрации
  message: {
    error: 'Слишком много попыток регистрации. Пожалуйста, попробуйте позже.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: '1 час'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Registration rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много попыток регистрации. Пожалуйста, попробуйте позже.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: '1 час'
    });
  }
});

/**
 * Rate limiter для запроса сброса пароля
 * Ограничение: 3 запроса за час с одного IP
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // Максимум 3 запроса
  message: {
    error: 'Слишком много запросов на сброс пароля. Пожалуйста, попробуйте позже.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: '1 час'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много запросов на сброс пароля. Пожалуйста, попробуйте позже.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: '1 час'
    });
  }
});

/**
 * Общий rate limiter для API
 * Ограничение: 100 запросов за 15 минут с одного IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Максимум 100 запросов
  message: {
    error: 'Слишком много запросов. Пожалуйста, попробуйте позже.',
    code: 'TOO_MANY_REQUESTS'
  },
  standardHeaders: true,
  legacyHeaders: false
});
