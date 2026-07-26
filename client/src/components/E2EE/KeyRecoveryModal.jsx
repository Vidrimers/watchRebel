import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import {
  generateAndUploadKeysWithBackup,
  restoreFromBackup,
  hasIdentityKey,
  hasServerKey
} from '../../services/e2ee';
import RecoveryPhraseModal from './RecoveryPhraseModal';
import styles from './KeyRecoveryModal.module.css';

const SCENARIOS = {
  LOADING: 'loading',
  FIRST_TIME: 'first_time',
  NEW_DEVICE: 'new_device',
};

const KeyRecoveryModal = ({ onClose, onKeyReady }) => {
  const { user } = useAppSelector((state) => state.auth);
  const [scenario, setScenario] = useState(SCENARIOS.LOADING);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewDeviceWarning, setShowNewDeviceWarning] = useState(false);

  useEffect(() => {
    determineScenario();
  }, [user?.id]);

  const determineScenario = async () => {
    if (!user?.id) return;

    if (hasIdentityKey()) {
      onKeyReady();
      return;
    }

    try {
      const serverHasKey = await hasServerKey(user.id);
      if (serverHasKey) {
        setScenario(SCENARIOS.NEW_DEVICE);
      } else {
        setScenario(SCENARIOS.FIRST_TIME);
      }
    } catch (err) {
      console.error('Ошибка проверки ключа:', err);
      setScenario(SCENARIOS.FIRST_TIME);
    }
  };

  const handleGenerateKey = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generateAndUploadKeysWithBackup();
      setGeneratedPhrase(result.recoveryPhrase);
    } catch (err) {
      console.error('Ошибка генерации ключа:', err);
      setError('Не удалось сгенерировать ключи. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhraseConfirmed = () => {
    setGeneratedPhrase(null);
    onKeyReady();
  };

  const handlePhraseCancelled = async () => {
    // Пользователь отменил — удаляем сгенерированные ключи
    // (бэкап не был подтверждён)
    setGeneratedPhrase(null);
    setError('Ключи не были сохранены. Пожалуйста, сохраните recovery-фразу.');
  };

  const handleRecoverKey = async () => {
    if (!recoveryPhrase.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await restoreFromBackup(recoveryPhrase.trim());
      onKeyReady();
    } catch (err) {
      console.error('Ошибка восстановления:', err);
      setError('Не удалось восстановить ключ. Проверьте recovery-фразу.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewKey = async () => {
    if (!showNewDeviceWarning) {
      setShowNewDeviceWarning(true);
      return;
    }
    await handleGenerateKey();
  };

  const handleClose = () => {
    onClose();
  };

  if (scenario === SCENARIOS.LOADING) {
    return null;
  }

  // Показ модалки с recovery-фразой после генерации ключей
  if (generatedPhrase) {
    return (
      <RecoveryPhraseModal
        phrase={generatedPhrase}
        onConfirm={handlePhraseConfirmed}
        onCancel={handlePhraseCancelled}
      />
    );
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>🔐 Шифрование секретных чатов</h3>
          <button className={styles.closeBtn} onClick={handleClose}>×</button>
        </div>

        <div className={styles.body}>
          {scenario === SCENARIOS.FIRST_TIME && (
            <>
              <p className={styles.description}>
                Для использования секретных чатов необходимо создать ключи шифрования.
                Ключи генерируются на вашем устройстве и позволяют обмениваться зашифрованными сообщениями.
              </p>
              <div className={styles.warning}>
                ⚠️ После создания ключей вам будет показана recovery-фраза. Сохраните её — это единственный способ восстановить доступ к секретным чатам на новом устройстве.
              </div>
            </>
          )}

          {scenario === SCENARIOS.NEW_DEVICE && (
            <>
              <p className={styles.description}>
                Вы вошли с нового устройства. Для доступа к секретным чатам необходимо восстановить ключи шифрования.
              </p>
              <textarea
                className={styles.input}
                placeholder="Введите recovery-фразу (12 слов)..."
                value={recoveryPhrase}
                onChange={(e) => setRecoveryPhrase(e.target.value)}
                disabled={loading}
              />
              <div className={styles.secondaryActions}>
                <div className={styles.divider}>или</div>
                {!showNewDeviceWarning ? (
                  <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={handleCreateNewKey}
                    disabled={loading}
                  >
                    Создать новый ключ (старые чаты будут недоступны)
                  </button>
                ) : (
                  <div className={styles.warningNewDevice}>
                    ⚠️ Вы уверены? Старые секретные чаты будут потеряны. Это действие необратимо.
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={handleCreateNewKey}
                        disabled={loading}
                      >
                        {loading ? <span className={styles.spinner}></span> : null}
                        Да, создать новый
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => setShowNewDeviceWarning(false)}
                        disabled={loading}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          {scenario === SCENARIOS.FIRST_TIME && (
            <>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleClose}
                disabled={loading}
              >
                Позже
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleGenerateKey}
                disabled={loading}
              >
                {loading ? <span className={styles.spinner}></span> : null}
                Создать ключи
              </button>
            </>
          )}

          {scenario === SCENARIOS.NEW_DEVICE && (
            <>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleClose}
                disabled={loading}
              >
                Позже
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleRecoverKey}
                disabled={loading || !recoveryPhrase.trim()}
              >
                {loading ? <span className={styles.spinner}></span> : null}
                Восстановить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeyRecoveryModal;
