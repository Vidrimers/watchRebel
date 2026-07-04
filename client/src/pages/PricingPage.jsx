import { useState, useEffect } from 'react';
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
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoContent, setInfoContent] = useState('');

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

            {infoContent && (
              <div className={styles.section}>
                <h2>{infoTitle || 'Информация'}</h2>
                <div className={styles.infoContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(infoContent) }} />
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
