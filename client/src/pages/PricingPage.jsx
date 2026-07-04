import { useState, useEffect } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './PricingPage.module.css';

const renderMarkdown = (text) => {
  if (!text) return null;
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/<spoiler>(.+?)<\/spoiler>/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>')
    .replace(/\n/g, '<br/>');
  return html;
};

const PricingPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.isAdmin || user?.id === '137981675';

  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);

  // Info block
  const [infoTitle, setInfoTitle] = useState('');
  const [infoContent, setInfoContent] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => { loadPricing(); }, []);

  const loadPricing = async () => {
    try {
      const r = await api.get('/settings/ad-pricing');
      setPricing(r.data);
      setInfoTitle(r.data.pricing_info_title || '');
      setInfoContent(r.data.pricing_info_content || '');
    } catch (err) {
      console.error('Ошибка загрузки прайса:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInfo = async () => {
    try {
      setSavingInfo(true);
      await api.put('/settings/pricing_info_title', { value: editTitle });
      await api.put('/settings/pricing_info_content', { value: editContent });
      setInfoTitle(editTitle);
      setInfoContent(editContent);
      setEditingInfo(false);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
    } finally {
      setSavingInfo(false);
    }
  };

  const startEditingInfo = () => {
    setEditTitle(infoTitle);
    setEditContent(infoContent);
    setEditingInfo(true);
  };

  const insertFormat = (before, after = '', placeholder = '') => {
    const ta = document.querySelector(`.${styles.infoTextarea}`);
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = editContent.substring(s, e), ins = sel || placeholder;
    setEditContent(editContent.substring(0, s) + before + ins + after + editContent.substring(e));
    setTimeout(() => {
      ta.focus();
      if (sel) { const p = s + before.length + sel.length; ta.setSelectionRange(p, p); }
      else { ta.setSelectionRange(s + before.length, s + before.length + placeholder.length); }
    }, 0);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <p className={styles.loading}>Загрузка...</p>
        </div>
      </div>
    );
  }

  const hasAnyPrice = pricing && (
    pricing.ad_price_site || pricing.ad_price_repeat ||
    pricing.ad_price_interval || pricing.ad_price_telegram
  );

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Прайс на рекламу</h1>

        {!hasAnyPrice ? (
          <p className={styles.noData}>Прайс ещё не настроен. Свяжитесь с администрацией для получения информации.</p>
        ) : (
          <>
            <div className={styles.section}>
              <h2>Реклама на сайте</h2>
              <div className={styles.priceList}>
                {pricing.ad_price_site && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Показ в закреплённых</span>
                    <span className={styles.priceValue}>{pricing.ad_price_site} ₽</span>
                  </div>
                )}
                {pricing.ad_price_repeat && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Повторения</span>
                    <span className={styles.priceValue}>{pricing.ad_price_repeat} ₽</span>
                  </div>
                )}
                {pricing.ad_price_interval && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Интервал повторений</span>
                    <span className={styles.priceValue}>{pricing.ad_price_interval} ₽</span>
                  </div>
                )}
              </div>
            </div>

            {pricing.ad_price_telegram && (
              <div className={styles.section}>
                <h2>Реклама в Telegram</h2>
                <div className={styles.priceList}>
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Рассылка всем пользователям</span>
                    <span className={styles.priceValue}>{pricing.ad_price_telegram} ₽</span>
                  </div>
                </div>
              </div>
            )}

            {/* Блок информации */}
            {(infoContent || isAdmin) && (
              <div className={styles.section}>
                <div className={styles.infoHeader}>
                  {editingInfo ? (
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={styles.infoTitleInput} placeholder="Заголовок блока" />
                  ) : (
                    <h2>{infoTitle || 'Информация'}</h2>
                  )}
                  {isAdmin && !editingInfo && (
                    <button onClick={startEditingInfo} className={styles.editBtn}><Icon name="edit" size="small" /> Редактировать</button>
                  )}
                </div>
                {editingInfo ? (
                  <div className={styles.infoEditor}>
                    <div className={styles.editorToolbar}>
                      <button onClick={() => insertFormat('**', '**', 'жирный')} title="Жирный"><strong>B</strong></button>
                      <button onClick={() => insertFormat('*', '*', 'курсив')} title="Курсив"><em>I</em></button>
                      <button onClick={() => insertFormat('__', '__', 'подчёркнутый')} title="Подчёркнутый"><u>U</u></button>
                      <button onClick={() => insertFormat('~~', '~~', 'зачёркнутый')} title="Зачёркнутый"><s>S</s></button>
                      <button onClick={() => insertFormat('`', '`', 'код')} title="Код inline">{'<>'}</button>
                      <button onClick={() => insertFormat('```\n', '\n```', 'код')} title="Блок кода">{'{ }'}</button>
                      <button onClick={() => insertFormat('\n> ', '', 'цитата')} title="Цитата"><span>"</span></button>
                      <button onClick={() => insertFormat('[', '](https://)', 'текст')} title="Ссылка">🔗</button>
                      <button onClick={() => insertFormat('\n• ', '', 'пункт')} title="Список">•</button>
                      <button onClick={() => insertFormat('\n1. ', '', 'пункт')} title="Нумерованный список">1.</button>
                      <button onClick={() => insertFormat('<spoiler>', '</spoiler>', 'спойлер')} title="Спойлер">⚠️</button>
                    </div>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className={styles.infoTextarea} rows={12} placeholder="Введите информацию..." />
                    <div className={styles.editorButtons}>
                      <button onClick={handleSaveInfo} className={styles.saveBtn} disabled={savingInfo}>{savingInfo ? 'Сохранение...' : 'Сохранить'}</button>
                      <button onClick={() => setEditingInfo(false)} className={styles.cancelBtn}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  infoContent && (
                    <div className={styles.infoContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(infoContent) }} />
                  )
                )}
              </div>
            )}

            {pricing.advertising_contacts && (
              <div className={styles.section}>
                <h2>Контакты</h2>
                <div className={styles.contacts}>
                  {pricing.advertising_contacts.split('\n').map((line, i) => {
                    if (!line.trim()) return null;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PricingPage;
