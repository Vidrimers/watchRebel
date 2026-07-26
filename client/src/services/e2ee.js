import { x25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import WORDLIST from './bip39-wordlist';
import api from './api';

const PRIVATE_KEY_STORAGE = 'e2ee_private_key';
const PUBLIC_KEY_STORAGE = 'e2ee_public_key';

/**
 * Сгенерировать новую пару ключей X25519
 * @returns {{ publicKey: Uint8Array, privateKey: Uint8Array }}
 */
export function generateIdentityKeyPair() {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

/**
 * Сохранить приватный ключ в localStorage (base64)
 * @param {Uint8Array} privateKey
 */
export function storePrivateKey(privateKey) {
  const base64 = uint8ArrayToBase64(privateKey);
  localStorage.setItem(PRIVATE_KEY_STORAGE, base64);
}

/**
 * Получить приватный ключ из localStorage
 * @returns {Uint8Array | null}
 */
export function getPrivateKey() {
  const base64 = localStorage.getItem(PRIVATE_KEY_STORAGE);
  if (!base64) return null;
  return base64ToUint8Array(base64);
}

/**
 * Сохранить публичный ключ в localStorage (base64)
 * @param {Uint8Array} publicKey
 */
export function storePublicKey(publicKey) {
  const base64 = uint8ArrayToBase64(publicKey);
  localStorage.setItem(PUBLIC_KEY_STORAGE, base64);
}

/**
 * Получить публичный ключ из localStorage (base64)
 * @returns {string | null}
 */
export function getPublicKeyBase64() {
  return localStorage.getItem(PUBLIC_KEY_STORAGE);
}

/**
 * Проверить наличие приватного ключа на устройстве
 * @returns {boolean}
 */
export function hasIdentityKey() {
  return localStorage.getItem(PRIVATE_KEY_STORAGE) !== null;
}

/**
 * Загрузить публичный ключ на сервер
 * @param {Uint8Array} publicKey
 * @returns {Promise<object>}
 */
export async function uploadPublicKey(publicKey) {
  const base64 = uint8ArrayToBase64(publicKey);
  const response = await api.post('/e2ee/keys', { publicKey: base64 });
  return response.data;
}

/**
 * Получить публичный ключ пользователя с сервера
 * @param {string} userId
 * @returns {Promise<{ publicKey: string, createdAt: string, updatedAt: string } | null>}
 */
export async function fetchPublicKey(userId) {
  try {
    const response = await api.get(`/e2ee/keys/${userId}`);
    return response.data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/**
 * Удалить свой публичный ключ с сервера
 * @returns {Promise<object>}
 */
export async function deletePublicKey() {
  const response = await api.delete('/e2ee/keys');
  return response.data;
}

/**
 * Полная инициализация: сгенерировать ключи, сохранить, загрузить на сервер
 * @returns {Promise<{ publicKey: string, keyId: string }>}
 */
export async function generateAndUploadKeys() {
  const { publicKey, privateKey } = generateIdentityKeyPair();

  storePrivateKey(privateKey);
  storePublicKey(publicKey);

  const result = await uploadPublicKey(publicKey);
  return result;
}

/**
 * Проверить, есть ли публичный ключ у пользователя на сервере
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasServerKey(userId) {
  const key = await fetchPublicKey(userId);
  return key !== null;
}

// === Сессионные ключи (ECDH + HKDF) ===

const SESSION_KEY_PREFIX = 'e2ee_session_';
const ROTATION_COUNTER_PREFIX = 'e2ee_rotation_';
const KEY_HISTORY_PREFIX = 'e2ee_key_history_';
const ROTATION_THRESHOLD = 100; // Ротация каждые N сообщений

/**
 * Вычислить общий секрет через X25519 ECDH
 * @param {Uint8Array} myPrivateKey - мой приватный ключ (32 bytes)
 * @param {string} theirPublicKeyBase64 - публичный ключ собеседника (base64)
 * @returns {Uint8Array} shared secret (32 bytes)
 */
export function computeSharedSecret(myPrivateKey, theirPublicKeyBase64) {
  const theirPublicKey = base64ToUint8Array(theirPublicKeyBase64);
  return x25519.getSharedSecret(myPrivateKey, theirPublicKey);
}

/**
 * Вывести сессионный ключ из shared_secret через HKDF (RFC 5869)
 * @param {Uint8Array} sharedSecret - общий секрет (32 bytes)
 * @param {string} conversationId - ID диалога (используется как salt)
 * @param {number} rotationCounter - счётчик ротации (для уникальности ключа)
 * @returns {Uint8Array} session key (32 bytes)
 */
export function deriveSessionKey(sharedSecret, conversationId, rotationCounter = 0) {
  const salt = new TextEncoder().encode(`${conversationId}:v${rotationCounter}`);
  const info = new TextEncoder().encode('watchrebel-e2ee-session-key-v1');

  // HKDF-Extract: PRK = HMAC-Hash(salt, IKM)
  const prk = hmac(sha256, salt, sharedSecret);

  // HKDF-Expand: OKM = HMAC-Hash(PRK, info || 0x01)
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 0x01;
  const okm = hmac(sha256, prk, infoWithCounter);

  return okm.slice(0, 32);
}

/**
 * Получить текущий счётчик ротации для диалога
 * @param {string} conversationId
 * @returns {number}
 */
export function getRotationCounter(conversationId) {
  const stored = localStorage.getItem(`${ROTATION_COUNTER_PREFIX}${conversationId}`);
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Сохранить счётчик ротации
 * @param {string} conversationId
 * @param {number} counter
 */
function storeRotationCounter(conversationId, counter) {
  localStorage.setItem(`${ROTATION_COUNTER_PREFIX}${conversationId}`, counter.toString());
}

/**
 * Сохранить сессионный ключ в localStorage
 * @param {string} conversationId
 * @param {Uint8Array} sessionKey
 * @param {number} rotationCounter
 */
export function storeSessionKey(conversationId, sessionKey, rotationCounter = 0) {
  const base64 = uint8ArrayToBase64(sessionKey);
  localStorage.setItem(`${SESSION_KEY_PREFIX}${conversationId}`, base64);
  storeRotationCounter(conversationId, rotationCounter);

  // Сохраняем в историю ключей (для расшифровки старых сообщений)
  const history = getKeyHistory(conversationId);
  history[rotationCounter] = base64;
  // Храним только последние 5 ключей
  const keys = Object.keys(history).map(Number).sort((a, b) => b - a);
  if (keys.length > 5) {
    for (let i = 5; i < keys.length; i++) {
      delete history[keys[i]];
    }
  }
  localStorage.setItem(`${KEY_HISTORY_PREFIX}${conversationId}`, JSON.stringify(history));
}

/**
 * Получить историю ключей
 * @param {string} conversationId
 * @returns {Object<number, string>} counter -> base64 key
 */
function getKeyHistory(conversationId) {
  const stored = localStorage.getItem(`${KEY_HISTORY_PREFIX}${conversationId}`);
  return stored ? JSON.parse(stored) : {};
}

/**
 * Получить сессионный ключ из localStorage
 * @param {string} conversationId
 * @returns {Uint8Array | null}
 */
export function getSessionKey(conversationId) {
  const base64 = localStorage.getItem(`${SESSION_KEY_PREFIX}${conversationId}`);
  if (!base64) return null;
  return base64ToUint8Array(base64);
}

/**
 * Получить сессионный ключ по номеру ротации (для расшифровки старых сообщений)
 * @param {string} conversationId
 * @param {number} rotationCounter
 * @returns {Uint8Array | null}
 */
export function getSessionKeyByRotation(conversationId, rotationCounter) {
  const history = getKeyHistory(conversationId);
  const base64 = history[rotationCounter];
  if (!base64) return null;
  return base64ToUint8Array(base64);
}

/**
 * Проверить, есть ли сессионный ключ для диалога
 * @param {string} conversationId
 * @returns {boolean}
 */
export function hasSessionKey(conversationId) {
  return localStorage.getItem(`${SESSION_KEY_PREFIX}${conversationId}`) !== null;
}

/**
 * Удалить сессионный ключ и историю
 * @param {string} conversationId
 */
export function removeSessionKey(conversationId) {
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${conversationId}`);
  localStorage.removeItem(`${ROTATION_COUNTER_PREFIX}${conversationId}`);
  localStorage.removeItem(`${KEY_HISTORY_PREFIX}${conversationId}`);
}

/**
 * Проверить, нужна ли ротация ключа
 * @param {string} conversationId
 * @param {number} messageCount - количество отправленных сообщений
 * @returns {boolean}
 */
export function needsRotation(conversationId, messageCount) {
  const counter = getRotationCounter(conversationId);
  return messageCount >= (counter + 1) * ROTATION_THRESHOLD;
}

/**
 * Выполнить ротацию сессионного ключа
 * @param {string} conversationId
 * @param {string} otherUserPublicKeyBase64
 * @returns {Uint8Array} новый сессионный ключ
 */
export function rotateSessionKey(conversationId, otherUserPublicKeyBase64) {
  const currentCounter = getRotationCounter(conversationId);
  const newCounter = currentCounter + 1;

  const privateKey = getPrivateKey();
  if (!privateKey) throw new Error('Приватный ключ E2EE не найден');

  const sharedSecret = computeSharedSecret(privateKey, otherUserPublicKeyBase64);
  const newSessionKey = deriveSessionKey(sharedSecret, conversationId, newCounter);

  storeSessionKey(conversationId, newSessionKey, newCounter);
  return newSessionKey;
}

/**
 * Получить или вычислить сессионный ключ для секретного чата
 * @param {string} conversationId
 * @param {string} otherUserPublicKeyBase64 - публичный ключ собеседника (base64)
 * @returns {Uint8Array} session key
 */
export function getOrCreateSessionKey(conversationId, otherUserPublicKeyBase64) {
  const existing = getSessionKey(conversationId);
  if (existing) return existing;

  const privateKey = getPrivateKey();
  if (!privateKey) throw new Error('Приватный ключ E2EE не найден');

  const sharedSecret = computeSharedSecret(privateKey, otherUserPublicKeyBase64);
  const counter = getRotationCounter(conversationId);
  const sessionKey = deriveSessionKey(sharedSecret, conversationId, counter);

  storeSessionKey(conversationId, sessionKey, counter);
  return sessionKey;
}

// === Шифрование/расшифровка сообщений (AES-256-GCM) ===

const E2EE_PREFIX = '[E2EE]';

/**
 * Зашифровать сообщение через AES-256-GCM
 * @param {string} plaintext - открытый текст
 * @param {Uint8Array} sessionKey - сессионный ключ (32 bytes)
 * @param {number} rotationCounter - счётчик ротации
 * @returns {Promise<string>} зашифрованная строка в формате "[E2EE]counter:base64(iv):base64(ciphertext)"
 */
export async function encryptMessage(plaintext, sessionKey, rotationCounter = 0) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', sessionKey, 'AES-GCM', false, ['encrypt']);
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const encryptedBytes = new Uint8Array(encrypted);
  return `${E2EE_PREFIX}${rotationCounter}:${uint8ArrayToBase64(iv)}:${uint8ArrayToBase64(encryptedBytes)}`;
}

/**
 * Расшифровать сообщение через AES-256-GCM
 * @param {string} encrypted - зашифрованная строка
 * @param {Uint8Array} sessionKey - сессионный ключ (32 bytes)
 * @returns {Promise<string>} открытый текст
 */
export async function decryptMessage(encrypted, sessionKey) {
  const withoutPrefix = encrypted.slice(E2EE_PREFIX.length);
  const parts = withoutPrefix.split(':');
  // Формат: counter:iv:ciphertext (или iv:ciphertext для обратной совместимости)
  let ivBase64, ciphertextBase64;
  if (parts.length === 3) {
    [, ivBase64, ciphertextBase64] = parts;
  } else {
    [ivBase64, ciphertextBase64] = parts;
  }
  const iv = base64ToUint8Array(ivBase64);
  const ciphertext = base64ToUint8Array(ciphertextBase64);
  const key = await crypto.subtle.importKey('raw', sessionKey, 'AES-GCM', false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Извлечь счётчик ротации из зашифрованного сообщения
 * @param {string} encrypted
 * @returns {number}
 */
export function extractRotationCounter(encrypted) {
  if (!isEncryptedMessage(encrypted)) return 0;
  const withoutPrefix = encrypted.slice(E2EE_PREFIX.length);
  const parts = withoutPrefix.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) || 0;
  }
  return 0;
}

/**
 * Проверить, зашифровано ли сообщение
 * @param {string} content
 * @returns {boolean}
 */
export function isEncryptedMessage(content) {
  return typeof content === 'string' && content.startsWith(E2EE_PREFIX);
}

// === Recovery Phrase (BIP39-подобная генерация) ===

const RECOVERY_PHRASE_WORDS = 12;
const PBKDF2_ITERATIONS = 100000;

/**
 * Сгенерировать recovery-фразу из 12 слов
 * @returns {string} фраза из 12 слов через пробел
 */
export function generateRecoveryPhrase() {
  const entropy = crypto.getRandomValues(new Uint8Array(16)); // 128 bits
  const words = [];

  for (let i = 0; i < RECOVERY_PHRASE_WORDS; i++) {
    // Каждые 2 байта → индекс в словаре (2048 слов = 11 бит)
    const byte1 = entropy[Math.floor(i * 13 / 8)];
    const byte2 = entropy[Math.floor(i * 13 / 8) + 1] || 0;
    const bitOffset = (i * 13) % 8;
    const index = ((byte1 << 8) | byte2) >> (8 - bitOffset - 11) & 0x7FF;

    // Используем crypto.getRandomValues для более равномерного распределения
    const randomIndex = crypto.getRandomValues(new Uint16Array(1))[0] % WORDLIST.length;
    words.push(WORDLIST[randomIndex]);
  }

  return words.join(' ');
}

/**
 * Валидировать recovery-фразу
 * @param {string} phrase
 * @returns {boolean}
 */
export function validateRecoveryPhrase(phrase) {
  if (!phrase || typeof phrase !== 'string') return false;
  const words = phrase.trim().toLowerCase().split(/\s+/);
  if (words.length !== RECOVERY_PHRASE_WORDS) return false;
  return words.every(word => WORDLIST.includes(word));
}

/**
 * Зашифровать приватный ключ recovery-фразой (PBKDF2 → AES-256-GCM)
 * @param {Uint8Array} privateKey - приватный ключ (32 bytes)
 * @param {string} phrase - recovery-фраза
 * @returns {Promise<{encryptedPrivateKey: string, salt: string, iv: string}>}
 */
export async function encryptPrivateKeyWithPhrase(privateKey, phrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from phrase using PBKDF2
  const encodedPhrase = new TextEncoder().encode(phrase.trim().toLowerCase());
  const keyMaterial = await crypto.subtle.importKey('raw', encodedPhrase, 'PBKDF2', false, ['deriveKey']);
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt private key
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, derivedKey, privateKey);

  return {
    encryptedPrivateKey: uint8ArrayToBase64(new Uint8Array(encrypted)),
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv)
  };
}

/**
 * Расшифровать приватный ключ recovery-фразой
 * @param {string} encryptedPrivateKeyBase64 - зашифрованный приватный ключ (base64)
 * @param {string} saltBase64 - salt (base64)
 * @param {string} ivBase64 - IV (base64)
 * @param {string} phrase - recovery-фраза
 * @returns {Promise<Uint8Array>} приватный ключ
 */
export async function decryptPrivateKeyWithPhrase(encryptedPrivateKeyBase64, saltBase64, ivBase64, phrase) {
  const encryptedBytes = base64ToUint8Array(encryptedPrivateKeyBase64);
  const salt = base64ToUint8Array(saltBase64);
  const iv = base64ToUint8Array(ivBase64);

  // Derive key from phrase using PBKDF2
  const encodedPhrase = new TextEncoder().encode(phrase.trim().toLowerCase());
  const keyMaterial = await crypto.subtle.importKey('raw', encodedPhrase, 'PBKDF2', false, ['deriveKey']);
  const derivedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt private key
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, derivedKey, encryptedBytes);
  return new Uint8Array(decrypted);
}

// === Backup API ===

/**
 * Загрузить зашифрованный бэкап на сервер
 * @param {string} encryptedPrivateKey
 * @param {string} salt
 * @param {string} iv
 * @returns {Promise<object>}
 */
export async function uploadBackup(encryptedPrivateKey, salt, iv) {
  const response = await api.post('/e2ee/backup', { encryptedPrivateKey, salt, iv });
  return response.data;
}

/**
 * Получить зашифрованный бэкап с сервера
 * @returns {Promise<{encryptedPrivateKey: string, salt: string, iv: string} | null>}
 */
export async function fetchBackup() {
  try {
    const response = await api.get('/e2ee/backup');
    return response.data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/**
 * Полная инициализация с recovery-фразой: генерация ключей + бэкап
 * @returns {Promise<{publicKey: string, keyId: string, recoveryPhrase: string}>}
 */
export async function generateAndUploadKeysWithBackup() {
  const { publicKey, privateKey } = generateIdentityKeyPair();
  const recoveryPhrase = generateRecoveryPhrase();

  // Сохраняем ключи локально
  storePrivateKey(privateKey);
  storePublicKey(publicKey);

  // Загружаем публичный ключ на сервер
  const keyResult = await uploadPublicKey(publicKey);

  // Шифруем приватный ключ фразой и загружаем бэкап
  const backup = await encryptPrivateKeyWithPhrase(privateKey, recoveryPhrase);
  await uploadBackup(backup.encryptedPrivateKey, backup.salt, backup.iv);

  return {
    publicKey: uint8ArrayToBase64(publicKey),
    keyId: keyResult.keyId,
    recoveryPhrase
  };
}

/**
 * Восстановить приватный ключ из бэкапа по recovery-фразе
 * @param {string} phrase - recovery-фраза
 * @returns {Promise<boolean>} true если восстановление успешно
 */
export async function restoreFromBackup(phrase) {
  const backup = await fetchBackup();
  if (!backup) throw new Error('Бэкап не найден на сервере');

  const privateKey = await decryptPrivateKeyWithPhrase(
    backup.encryptedPrivateKey,
    backup.salt,
    backup.iv,
    phrase
  );

  // Сохраняем восстановленный приватный ключ
  storePrivateKey(privateKey);

  // Вычисляем и сохраняем публичный ключ
  const publicKey = x25519.getPublicKey(privateKey);
  storePublicKey(publicKey);

  return true;
}

// === Утилиты ===

function uint8ArrayToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
