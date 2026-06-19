import React, { useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import Icon from '../Common/Icon';
import useConfirm from '../../hooks/useConfirm.jsx';
import useAlert from '../../hooks/useAlert.jsx';
import api from '../../services/api';
import styles from './TelegramConnectionBlock.module.css';

const EmailConnectionBlock = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('idle'); // idle | enter_email | enter_code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState('');

  const isEmailLinked = Boolean(user?.email);
  const isEmailVerified = Boolean(user?.emailVerified);

  const handleLinkEmail = async () => {
    if (!email.trim()) return;

    try {
      setLoading(true);
      const response = await api.post('/auth/link-email', { email: email.trim() });
      setCodeSent(email.trim());
      setStep('enter_code');
      await showAlert({
        title: 'Код отправлен',
        message: response.data.message,
        type: 'success'
      });
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отправить код.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) return;

    try {
      setLoading(true);
      await api.post('/auth/link-email/verify', { code: code.trim() });
      await showAlert({
        title: 'Успешно',
        message: 'Email успешно привязан!',
        type: 'success'
      });
      window.location.reload();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Неверный код.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkEmail = async () => {
    const confirmed = await showConfirm({
      title: 'Отвязать Email',
      message: 'Вы уверены, что хотите отвязать Email? Вы не сможете входить через email.',
      confirmText: 'Отвязать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });

    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete('/auth/unlink-email');
      await showAlert({
        title: 'Успешно',
        message: 'Email успешно отвязан',
        type: 'success'
      });
      window.location.reload();
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось отвязать email.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setEmail('');
    setCode('');
    setCodeSent('');
  };

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={styles.settingsCard}>
        <h3 className={styles.cardTitle}><Icon name="email" size="medium" /> Email</h3>
        
        {isEmailLinked ? (
          <div className={styles.linkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusLinked}>
                {isEmailVerified ? '✅ Привязан и подтверждён' : '⚠️ Привязан (не подтверждён)'}
              </span>
            </div>
            
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email:</span>
              <span className={styles.infoValue}>{user.email}</span>
            </div>

            <button 
              onClick={handleUnlinkEmail} 
              className={styles.unlinkButton}
              disabled={loading}
            >
              {loading ? 'Отвязка...' : 'Отвязать Email'}
            </button>
          </div>
        ) : step === 'enter_email' ? (
          <div className={styles.notLinkedContainer}>
            <p className={styles.description}>Введите email для привязки к аккаунту.</p>
            
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={styles.input}
              disabled={loading}
            />

            <div className={styles.buttonRow}>
              <button 
                onClick={handleCancel} 
                className={styles.cancelButton}
                disabled={loading}
              >
                Отмена
              </button>
              <button 
                onClick={handleLinkEmail} 
                className={styles.linkButton}
                disabled={loading || !email.trim()}
              >
                {loading ? 'Отправка...' : 'Отправить код'}
              </button>
            </div>
          </div>
        ) : step === 'enter_code' ? (
          <div className={styles.notLinkedContainer}>
            <p className={styles.description}>Код отправлен на <strong>{codeSent}</strong>. Введите его ниже.</p>
            
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className={styles.input}
              maxLength={6}
              disabled={loading}
            />

            <div className={styles.buttonRow}>
              <button 
                onClick={handleCancel} 
                className={styles.cancelButton}
                disabled={loading}
              >
                Отмена
              </button>
              <button 
                onClick={handleVerifyCode} 
                className={styles.linkButton}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Проверка...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.notLinkedContainer}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Статус:</span>
              <span className={styles.statusNotLinked}>❌ Не привязан</span>
            </div>

            <p className={styles.description}>
              Привяжите email для входа по почте и паролю, а также для восстановления аккаунта.
            </p>

            <button 
              onClick={() => setStep('enter_email')} 
              className={styles.linkButton}
              disabled={loading}
            >
              Привязать Email
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default EmailConnectionBlock;
