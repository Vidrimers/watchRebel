import { useState, useEffect } from 'react';
import api from '../services/api';
import styles from './PricingPage.module.css';

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

  const currencySymbols = { RUB: '₽', USD: '$', EUR: '€', KAS: 'KAS', TON: 'TON', USDT: 'USDT', STARS: '⭐' };
  const currency = pricing?.ad_currency || 'RUB';
  const currencySymbol = currencySymbols[currency] || '₽';

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
                {pricing.ad_price_site && pricing.ad_price_site !== '0' && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Показ в закреплённых</span>
                    <span className={styles.priceValue}>{pricing.ad_price_site} {currencySymbol}</span>
                  </div>
                )}
                {pricing.ad_price_repeat && pricing.ad_price_repeat !== '0' && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Повторения</span>
                    <span className={styles.priceValue}>{pricing.ad_price_repeat} {currencySymbol}</span>
                  </div>
                )}
                {pricing.ad_price_interval && pricing.ad_price_interval !== '0' && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Интервал повторений</span>
                    <span className={styles.priceValue}>{pricing.ad_price_interval} {currencySymbol}</span>
                  </div>
                )}
              </div>
            </div>

            {pricing.ad_price_telegram && pricing.ad_price_telegram !== '0' && (
              <div className={styles.section}>
                <h2>Реклама в Telegram</h2>
                <div className={styles.priceList}>
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Рассылка всем пользователям</span>
                    <span className={styles.priceValue}>{pricing.ad_price_telegram} {currencySymbol}</span>
                  </div>
                  {pricing.ad_price_tg_repeat && pricing.ad_price_tg_repeat !== '0' && (
                    <div className={styles.priceItem}>
                      <span className={styles.priceLabel}>Повторения в ТГ</span>
                      <span className={styles.priceValue}>{pricing.ad_price_tg_repeat} {currencySymbol}</span>
                    </div>
                  )}
                  {pricing.ad_price_tg_interval && pricing.ad_price_tg_interval !== '0' && (
                    <div className={styles.priceItem}>
                      <span className={styles.priceLabel}>Интервал повторений в ТГ</span>
                      <span className={styles.priceValue}>{pricing.ad_price_tg_interval} {currencySymbol}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {infoContent && infoContent.replace(/<[^>]*>/g, '').trim() && (
              <div className={styles.section}>
                <h2>{infoTitle || 'Информация'}</h2>
                <div className={styles.infoContent} dangerouslySetInnerHTML={{ __html: infoContent }} />
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
