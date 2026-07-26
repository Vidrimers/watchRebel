import React, { useState, useCallback } from 'react';
import styles from './RecoveryPhraseModal.module.css';

const RecoveryPhraseModal = ({ phrase, onConfirm, onCancel }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const words = phrase ? phrase.split(' ') : [];

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback для старых браузеров
      const textarea = document.createElement('textarea');
      textarea.value = phrase;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [phrase]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([phrase], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watchrebel-recovery-phrase.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [phrase]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>🔑 Recovery-фраза</h3>
          <button className={styles.closeBtn} onClick={onCancel}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.warning}>
            Сохраните эту фразу в безопасном месте. Это единственный способ восстановить доступ к секретным чатам на новом устройстве. Мы не храним фразу и не можем её восстановить.
          </div>

          <div className={styles.wordGrid}>
            {words.map((word, index) => (
              <div key={index} className={styles.wordItem}>
                <span className={styles.wordNumber}>{index + 1}.</span>
                <span className={styles.wordText}>{word}</span>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleCopy}
            >
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleDownload}
            >
              Скачать .txt
            </button>
          </div>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className={styles.checkbox}
            />
            Я сохранил фразу в безопасном месте
          </label>
        </div>

        <div className={styles.footer}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onConfirm}
            disabled={!confirmed}
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoveryPhraseModal;
