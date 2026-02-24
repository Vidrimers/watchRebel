import helmet from 'helmet';

/**
 * Настройка Helmet для улучшения безопасности
 * @returns {Function} - Middleware функция
 */
export function configureHelmet() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Для React и Vite
          "'unsafe-eval'", // Для Telegram Login Widget (использует eval)
          "https://telegram.org", // Telegram Login Widget
          "https://oauth.telegram.org" // Telegram OAuth
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'" // Для CSS модулей
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "http:", // Для изображений из TMDb и других источников
          "blob:"
        ],
        fontSrc: [
          "'self'",
          "data:"
        ],
        connectSrc: [
          "'self'",
          "https://api.themoviedb.org", // TMDb API
          "https://image.tmdb.org", // TMDb изображения
          "wss:", // WebSocket
          "ws:" // WebSocket для разработки
        ],
        frameSrc: [
          "'self'",
          "https://oauth.telegram.org", // Telegram OAuth
          "https://accounts.google.com", // Google OAuth
          "https://discord.com" // Discord OAuth
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    
    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },
    
    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },
    
    // Hide X-Powered-By
    hidePoweredBy: true,
    
    // HTTP Strict Transport Security (HSTS)
    hsts: {
      maxAge: 31536000, // 1 год
      includeSubDomains: true,
      preload: true
    },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },
    
    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    
    // X-XSS-Protection
    xssFilter: true
  });
}

/**
 * Настройка CORS
 * @returns {Object} - Опции CORS
 */
export function configureCORS() {
  const allowedOrigins = [
    process.env.PUBLIC_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:1313', // Когда фронтенд отдается с бэкенда
    'http://localhost:5173', // Vite dev server
    'https://watchrebel.ru',
    'https://dev.watchrebel.ru'
  ];

  return {
    origin: function (origin, callback) {
      // Разрешаем запросы без origin (например, мобильные приложения, Postman)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`CORS: Запрос с неразрешенного origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Разрешаем отправку cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 часа
  };
}

/**
 * Middleware для установки secure cookies в production
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function secureSessionMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    // Устанавливаем secure флаг для cookies в production
    res.cookie = function (name, value, options = {}) {
      options.secure = true; // Только HTTPS
      options.httpOnly = true; // Недоступно для JavaScript
      options.sameSite = 'strict'; // Защита от CSRF
      return res.cookie.call(this, name, value, options);
    };
  }
  next();
}

/**
 * Middleware для логирования подозрительных запросов
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function securityLogger(req, res, next) {
  // Проверяем на подозрительные паттерны в URL
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script>/i, // XSS
    /union.*select/i, // SQL injection
    /exec\(/i, // Code injection
    /eval\(/i // Code injection
  ];

  const url = req.url;
  const body = JSON.stringify(req.body);

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(body)) {
      console.warn(`⚠️ Подозрительный запрос обнаружен:`, {
        ip: req.ip,
        method: req.method,
        url: req.url,
        body: req.body,
        headers: req.headers
      });
      break;
    }
  }

  next();
}
