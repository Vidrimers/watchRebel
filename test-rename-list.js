/**
 * Скрипт для тестирования функции переименования списков
 * 
 * Запуск:
 * 1. Запустите сервер: npm run start
 * 2. В другом терминале: node test-rename-list.js
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

// Тестовый токен (нужно получить реальный токен из базы данных)
// Для теста можно временно отключить проверку токена в middleware
const TEST_TOKEN = 'test-token';

async function testRenameList() {
  console.log('🧪 Тестирование функции переименования списков\n');

  try {
    // 1. Создаем тестовый список
    console.log('1️⃣ Создание тестового списка...');
    const createResponse = await fetch(`${API_URL}/lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        name: 'Тестовый список',
        mediaType: 'movie'
      })
    });

    if (!createResponse.ok) {
      console.error('❌ Ошибка создания списка:', await createResponse.text());
      return;
    }

    const createdList = await createResponse.json();
    console.log('✅ Список создан:', createdList);
    console.log('   ID:', createdList.id);
    console.log('   Название:', createdList.name);
    console.log('');

    // 2. Переименовываем список
    console.log('2️⃣ Переименование списка...');
    const renameResponse = await fetch(`${API_URL}/lists/${createdList.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        name: 'Новое название списка'
      })
    });

    if (!renameResponse.ok) {
      console.error('❌ Ошибка переименования:', await renameResponse.text());
      return;
    }

    const renamedList = await renameResponse.json();
    console.log('✅ Список переименован:', renamedList);
    console.log('   ID:', renamedList.id);
    console.log('   Новое название:', renamedList.name);
    console.log('');

    // 3. Проверяем, что название изменилось
    console.log('3️⃣ Проверка изменений...');
    const getResponse = await fetch(`${API_URL}/lists`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });

    if (!getResponse.ok) {
      console.error('❌ Ошибка получения списков:', await getResponse.text());
      return;
    }

    const lists = await getResponse.json();
    const updatedList = lists.find(l => l.id === createdList.id);

    if (updatedList && updatedList.name === 'Новое название списка') {
      console.log('✅ Название успешно изменено!');
      console.log('   Старое название: "Тестовый список"');
      console.log('   Новое название: "' + updatedList.name + '"');
    } else {
      console.log('❌ Название не изменилось');
    }
    console.log('');

    // 4. Удаляем тестовый список
    console.log('4️⃣ Удаление тестового списка...');
    const deleteResponse = await fetch(`${API_URL}/lists/${createdList.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });

    if (deleteResponse.ok) {
      console.log('✅ Тестовый список удален');
    } else {
      console.log('⚠️ Не удалось удалить тестовый список');
    }

    console.log('\n✨ Тест завершен успешно!');

  } catch (error) {
    console.error('❌ Ошибка при выполнении теста:', error.message);
  }
}

// Тест с пустым названием
async function testEmptyName() {
  console.log('\n🧪 Тестирование валидации пустого названия\n');

  try {
    const response = await fetch(`${API_URL}/lists/test-id`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        name: '   '
      })
    });

    const result = await response.json();

    if (response.status === 400 && result.code === 'EMPTY_NAME') {
      console.log('✅ Валидация пустого названия работает корректно');
      console.log('   Код ошибки:', result.code);
      console.log('   Сообщение:', result.error);
    } else {
      console.log('❌ Валидация не сработала');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

// Запускаем тесты
console.log('═══════════════════════════════════════════════════════');
console.log('  ТЕСТИРОВАНИЕ ПЕРЕИМЕНОВАНИЯ СПИСКОВ');
console.log('═══════════════════════════════════════════════════════\n');

testRenameList()
  .then(() => testEmptyName())
  .then(() => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ');
    console.log('═══════════════════════════════════════════════════════\n');
  });
