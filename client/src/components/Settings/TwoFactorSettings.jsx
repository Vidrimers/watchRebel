import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { logout } from '../../store/slices/authSlice';
import Icon from '../Common/Icon';
import useAlert from '../../hooks/useAlert.jsx';
import useConfirm from '../../hooks/useConfirm.jsx';
import api from '../../services/api';
import styles from './TwoFactorSettings.module.css';

/**
 * Компонент настроек двухфакторной аутентификации (2FA)
 * Отображается в секции "Аккаунт и безопасность"
 */
function TwoFactorSettings() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { alertDialog, showAlert } = useAlert();
  const { confirmDialog, showConfirm } = useConfirm();

  const [status, setStatus] = useState(null); // null = загрузка, false = выключена, true = включена
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUrl, qrCode }
  const [setupStep, setSetupStep] = useState(null); // null, 'qr', 'verify', 'backup'
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);
  const [disableStep, setDisableStep] = useState(null); // null, 'confirm'
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Загрузка статуса 2FA
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const result = await api.post('/2fa/status');
      setStatus(result.data.enabled);
      if (result.data.enabled) {
        fetchTrustedDevices();
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса 2FA:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка доверенных устройств
  const fetchTrustedDevices = async () => {
    try {
      setLoadingDevices(true);
      const result = await api.get('/2fa/trusted-devices');
      setTrustedDevices(result.data);
    } catch (error) {
      console.error('Ошибка загрузки trusted devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Начало настройки 2FA
  const handleStartSetup = async () => {
    try {
      const result = await api.post('/2fa/setup');
      setSetupData(result.data);
      setSetupStep('qr');
    } catch (error) {
      console.error('Ошибка setup 2FA:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось начать настройку 2FA',
        type: 'error'
      });
    }
  };

  // Подтверждение кода
  const handleConfirmCode = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      await showAlert({
        title: 'Ошибка',
        message: 'Введите 6-значный код',
        type: 'warning'
      });
      return;
    }

    try {
      const result = await api.post('/2fa/confirm', { code: verifyCode });
      setBackupCodes(result.data.backupCodes);
      setSetupStep('backup');
      setStatus(true);
    } catch (error) {
      console.error('Ошибка confirm 2FA:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Неверный код',
        type: 'error'
      });
    }
  };

  // Завершение настройки
  const handleFinishSetup = async () => {
    if (!backupCodesSaved) {
      await showAlert({
        title: 'Внимание',
        message: 'Сначала сохраните backup-коды!',
        type: 'warning'
      });
      return;
    }
    await showAlert({
      title: '2FA включена',
      message: 'Для завершения необходимо войти заново с кодом 2FA.',
      type: 'success'
    });
    await dispatch(logout());
    navigate('/login', { replace: true });
  };

  // Отключение 2FA
  const handleStartDisable = () => {
    setDisableStep('confirm');
    setDisablePassword('');
    setDisableCode('');
  };

  const handleConfirmDisable = async () => {
    try {
      await api.post('/2fa/disable', {
        password: disablePassword || undefined,
        totpCode: disableCode || undefined
      });
      setStatus(false);
      setDisableStep(null);
      setTrustedDevices([]);
      await showAlert({
        title: 'Успешно',
        message: '2FA отключена',
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка disable 2FA:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отключить 2FA',
        type: 'error'
      });
    }
  };

  // Отзыв устройства
  const handleRevokeDevice = async (deviceId) => {
    const confirmed = await showConfirm({
      title: 'Отозвать устройство?',
      message: 'Устройство будет отозвано. При следующем входе потребуется 2FA.',
      confirmText: 'Отозвать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete(`/2fa/trusted-devices/${deviceId}`);
      setTrustedDevices(prev => prev.filter(d => d.id !== deviceId));
      await showAlert({
        title: 'Успешно',
        message: 'Устройство отозвано',
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка отзыва устройства:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось отозвать устройство',
        type: 'error'
      });
    }
  };

  // Отзыв всех устройств
  const handleRevokeAllDevices = async () => {
    const confirmed = await showConfirm({
      title: 'Отозвать все устройства?',
      message: 'Все доверенные устройства будут отозваны (кроме текущего).',
      confirmText: 'Отозвать все',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete('/2fa/trusted-devices');
      await fetchTrustedDevices();
      await showAlert({
        title: 'Успешно',
        message: 'Все устройства отозваны',
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка отзыва всех устройств:', error);
      await showAlert({
        title: 'Ошибка',
        message: 'Не удалось отозвать устройства',
        type: 'error'
      });
    }
  };

  // Регенерация backup-кодов
  const handleRegenerateBackupCodes = async () => {
    const confirmed = await showConfirm({
      title: 'Регенерировать backup-коды?',
      message: 'Старые backup-коды перестанут действовать.',
      confirmText: 'Регенерировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'primary'
    });
    if (!confirmed) return;

    try {
      const result = await api.post('/2fa/regenerate-backup-codes', {
        totpCode: verifyCode || undefined
      });
      setBackupCodes(result.data.backupCodes);
      setBackupCodesSaved(false);
      await showAlert({
        title: 'Успешно',
        message: 'Новые backup-коды сгенерированы',
        type: 'success'
      });
    } catch (error) {
      console.error('Ошибка регенерации backup codes:', error);
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось регенерировать коды',
        type: 'error'
      });
    }
  };

  // Копирование backup-кодов
  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    showAlert({
      title: 'Скопировано',
      message: 'Backup-коды скопированы в буфер обмена',
      type: 'success'
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Icon name="loader" size="medium" />
        <span>Загрузка...</span>
      </div>
    );
  }

  return (
    <>
      {alertDialog}
      {confirmDialog}

      <div className={styles.container}>
        <h4 className={styles.sectionTitle}>Двухфакторная аутентификация (2FA)</h4>
        <p className={styles.description}>
          Дополнительный уровень безопасности для вашего аккаунта. После включения при входе потребуется ввод кода из приложения-аутентификатора.
        </p>

        {/* Статус 2FA */}
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>Статус:</span>
          <span className={`${styles.statusBadge} ${status ? styles.statusEnabled : styles.statusDisabled}`}>
            {status ? 'Включена' : 'Выключена'}
          </span>
        </div>

        {/* Кнопки действий */}
        {!status && !setupStep && (
          <button onClick={handleStartSetup} className={styles.enableButton}>
            <Icon name="shield" size="small" /> Включить 2FA
          </button>
        )}

        {status && !disableStep && (
          <div className={styles.actions}>
            <button onClick={() => { setDisableStep('confirm'); fetchTrustedDevices(); }} className={styles.disableButton}>
              <Icon name="shield-off" size="small" /> Отключить 2FA
            </button>
            <button onClick={handleRegenerateBackupCodes} className={styles.secondaryButton}>
              Регенерировать backup-коды
            </button>
          </div>
        )}

        {/* Шаг 1: QR-код */}
        {setupStep === 'qr' && setupData && (
          <div className={styles.setupSection}>
            <h5 className={styles.setupTitle}>Шаг 1: Сканируйте QR-код</h5>
            <p className={styles.setupDescription}>
              Откройте приложение-аутентификатор (Google Authenticator, Authy и т.п.) и отсканируйте QR-код.
            </p>

            <div className={styles.qrContainer}>
              <img src={setupData.qrCode} alt="QR Code" className={styles.qrCode} />
            </div>

            <div className={styles.secretContainer}>
              <p className={styles.secretLabel}>Или введите ключ вручную:</p>
              <code className={styles.secretCode}>{setupData.secret}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(setupData.secret);
                  showAlert({ title: 'Скопировано', message: 'Ключ скопирован', type: 'success' });
                }}
                className={styles.copyButton}
              >
                Копировать
              </button>
            </div>

            <button onClick={() => setSetupStep('verify')} className={styles.nextButton}>
              Далее
            </button>
          </div>
        )}

        {/* Шаг 2: Подтверждение кода */}
        {setupStep === 'verify' && (
          <div className={styles.setupSection}>
            <h5 className={styles.setupTitle}>Шаг 2: Подтвердите код</h5>
            <p className={styles.setupDescription}>
              Введите 6-значный код из приложения-аутентификатора.
            </p>

            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={styles.codeInput}
              maxLength={6}
            />

            <div className={styles.setupActions}>
              <button onClick={() => setSetupStep('qr')} className={styles.backButton}>
                Назад
              </button>
              <button onClick={handleConfirmCode} className={styles.nextButton} disabled={verifyCode.length !== 6}>
                Подтвердить
              </button>
            </div>
          </div>
        )}

        {/* Шаг 3: Backup-коды */}
        {setupStep === 'backup' && backupCodes.length > 0 && (
          <div className={styles.setupSection}>
            <h5 className={styles.setupTitle}>Шаг 3: Сохраните backup-коды</h5>
            <p className={styles.setupDescription}>
              Эти коды можно использовать для входа, если вы потеряли доступ к приложению-аутентификатору.
              Каждый код можно использовать только один раз.
            </p>

            <div className={styles.backupCodesContainer}>
              {backupCodes.map((code, index) => (
                <div key={index} className={styles.backupCode}>
                  {code}
                </div>
              ))}
            </div>

            <div className={styles.backupActions}>
              <button onClick={handleCopyBackupCodes} className={styles.secondaryButton}>
                Скопировать все
              </button>
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={backupCodesSaved}
                onChange={(e) => setBackupCodesSaved(e.target.checked)}
              />
              <span>Я сохранил backup-коды в надёжном месте</span>
            </label>

            <button onClick={handleFinishSetup} className={styles.finishButton} disabled={!backupCodesSaved}>
              Завершить настройку
            </button>
          </div>
        )}

        {/* Отключение 2FA */}
        {disableStep === 'confirm' && (
          <div className={styles.setupSection}>
            <h5 className={styles.setupTitle}>Отключение 2FA</h5>
            <p className={styles.setupDescription}>
              Для отключения 2FA введите пароль или код из аутентификатора.
            </p>

            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Пароль"
              className={styles.input}
            />

            <div className={styles.divider}>
              <span>или</span>
            </div>

            <input
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={styles.codeInput}
              maxLength={6}
            />

            <div className={styles.setupActions}>
              <button onClick={() => setDisableStep(null)} className={styles.backButton}>
                Отмена
              </button>
              <button
                onClick={handleConfirmDisable}
                className={styles.disableConfirmButton}
                disabled={!disablePassword && !disableCode}
              >
                Отключить 2FA
              </button>
            </div>
          </div>
        )}

        {/* Доверенные устройства */}
        {status && disableStep !== 'confirm' && (
          <div className={styles.devicesSection}>
            <h5 className={styles.devicesTitle}>Доверенные устройства</h5>
            <p className={styles.devicesDescription}>
              Устройства, на которых не требуется вводить код 2FA при входе.
            </p>

            {loadingDevices ? (
              <div className={styles.loadingDevices}>Загрузка...</div>
            ) : trustedDevices.length === 0 ? (
              <div className={styles.noDevices}>Нет доверенных устройств</div>
            ) : (
              <>
                <div className={styles.devicesList}>
                  {trustedDevices.map(device => (
                    <div key={device.id} className={styles.deviceItem}>
                      <div className={styles.deviceInfo}>
                        <span className={styles.deviceName}>{device.device_name || 'Неизвестное устройство'}</span>
                        <span className={styles.deviceMeta}>
                          {device.ip_address} · {new Date(device.last_used_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRevokeDevice(device.id)}
                        className={styles.revokeButton}
                      >
                        Отозвать
                      </button>
                    </div>
                  ))}
                </div>
                {trustedDevices.length > 1 && (
                  <button onClick={handleRevokeAllDevices} className={styles.revokeAllButton}>
                    Отозвать все устройства
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default TwoFactorSettings;
