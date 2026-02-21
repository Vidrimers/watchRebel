import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения из корневой директории
const envPath = path.join(__dirname, '../../../.env');
console.log('📁 Загрузка .env из:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('❌ Ошибка загрузки .env:', envResult.error);
  process.exit(1);
} else {
  console.log('✅ .env загружен успешно');
  console.log('🔑 TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Есть' : 'Отсутствует');
  console.log('🎬 TMDB_API_KEY:', process.env.TMDB_API_KEY ? `Есть (${process.env.TMDB_API_KEY.substring(0, 10)}...)` : 'Отсутствует');
  console.log('🎬 TMDB_API_ACCESS_KEY:', process.env.TMDB_API_ACCESS_KEY ? `Есть (${process.env.TMDB_API_ACCESS_KEY.substring(0, 20)}...)` : 'Отсутствует');
}

export default envResult;
