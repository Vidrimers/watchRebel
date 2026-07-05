import { useState, useEffect } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './PricingPage.module.css';

const PricingPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoContent, setInfoContent] = useState('');
  const [sendingTg, setSendingTg] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Каналы
  const [channelSite, setChannelSite] = useState(false);
  const [channelTg, setChannelTg] = useState(false);

  // Калькулятор — сайт
  const [sitePinQty, setSitePinQty] = useState(0);
  const [siteRepeatQty, setSiteRepeatQty] = useState(0);
  const [siteInterval, setSiteInterval] = useState(0);

  // Калькулятор — ТГ
  const [tgMailingQty, setTgMailingQty] = useState(0);
  const [tgRepeatQty, setTgRepeatQty] = useState(0);
  const [tgInterval, setTgInterval] = useState(0);

  // Дополнительно
  const [autoDeleteOff, setAutoDeleteOff] = useState(false);

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

  const currencySymbols = { RUB: '₽', USD: '$', EUR: '€', KAS: 'KAS', TON: 'TON', USDT: 'USDT', STARS: 'STARS' };
  const currency = pricing?.ad_currency || 'RUB';
  const sym = currencySymbols[currency] || '₽';

  const renderCurrency = () => currency === 'STARS' ? <><Icon name="stars" size="small" /> STARS</> : sym;

  const price = (key) => parseInt(pricing?.[key]) || 0;

  // Расчёт стоимости
  const sitePinCost = price('ad_price_site') * sitePinQty;
  const siteRepeatCost = price('ad_price_repeat') * siteRepeatQty;
  const tgMailingCost = price('ad_price_telegram') * tgMailingQty;
  const tgRepeatCost = price('ad_price_tg_repeat') * tgRepeatQty;
  const autoDeleteOffCost = autoDeleteOff ? price('ad_price_auto_delete_off') : 0;

  const total = sitePinCost + siteRepeatCost + tgMailingCost + tgRepeatCost + autoDeleteOffCost;

  // Формирование текста для копирования
  const buildOrderText = () => {
    const lines = ['Заказ рекламы на watchRebel', ''];

    if (channelSite) {
      lines.push('Реклама на сайте:');
      if (sitePinQty > 0) lines.push(`  Показы в закреплённых: ${sitePinQty} шт. × ${price('ad_price_site')} ${renderCurrency()} = ${sitePinCost} ${renderCurrency()}`);
      if (siteRepeatQty > 0) lines.push(`  Повторения: ${siteRepeatQty} шт. × ${price('ad_price_repeat')} ${renderCurrency()} = ${siteRepeatCost} ${renderCurrency()}`);
      if (siteInterval > 0) lines.push(`  Интервал: ${siteInterval} ч.`);
      if (autoDeleteOff && price('ad_price_auto_delete_off') > 0) lines.push(`  Отключение автоудаления: ${price('ad_price_auto_delete_off')} ${renderCurrency()}`);
      lines.push('');
    }

    if (channelTg) {
      lines.push('Реклама в Telegram:');
      if (tgMailingQty > 0) lines.push(`  Рассылка: ${tgMailingQty} шт. × ${price('ad_price_telegram')} ${renderCurrency()} = ${tgMailingCost} ${renderCurrency()}`);
      if (tgRepeatQty > 0) lines.push(`  Повторения: ${tgRepeatQty} шт. × ${price('ad_price_tg_repeat')} ${renderCurrency()} = ${tgRepeatCost} ${renderCurrency()}`);
      if (tgInterval > 0) lines.push(`  Интервал: ${tgInterval} ч.`);
      lines.push('');
    }

    lines.push(`Итого: ${total} ${renderCurrency()}`);
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildOrderText()).then(() => {
      setSendResult('Скопировано в буфер обмена!');
      setTimeout(() => setSendResult(null), 3000);
    });
  };

  const handleSendTg = async () => {
    if (!user?.telegramId) {
      setSendResult('Для отправки необходимо привязать Telegram в настройках');
      setTimeout(() => setSendResult(null), 5000);
      return;
    }
    try {
      setSendingTg(true);
      await api.post('/admin/telegram-announcement-self', {
        content: buildOrderText(),
        type: 'advertising'
      });
      setSendResult('Запрос отправлен вам в Telegram!');
      setTimeout(() => setSendResult(null), 5000);
    } catch (err) {
      setSendResult('Ошибка отправки. Попробуйте скопировать текст вручную.');
      setTimeout(() => setSendResult(null), 5000);
    } finally {
      setSendingTg(false);
    }
  };

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
            {/* ===== Прайс ===== */}
            <div className={styles.section}>
              <h2>Реклама на сайте</h2>
              <div className={styles.priceList}>
                {price('ad_price_site') > 0 && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Показ в закреплённых</span>
                    <span className={styles.priceValue}>{price('ad_price_site')} {renderCurrency()}</span>
                  </div>
                )}
                {price('ad_price_repeat') > 0 && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Повторения</span>
                    <span className={styles.priceValue}>{price('ad_price_repeat')} {renderCurrency()}</span>
                  </div>
                )}
                {price('ad_price_interval') > 0 && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Интервал повторений</span>
                    <span className={styles.priceValue}>{price('ad_price_interval')} {renderCurrency()}</span>
                  </div>
                )}
                {price('ad_price_auto_delete_off') > 0 && (
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Отключение автоудаления</span>
                    <span className={styles.priceValue}>{price('ad_price_auto_delete_off')} {renderCurrency()}</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                При отключении автоудаления рекламный пост не удаляется после исчерпания повторов/закрепления и продолжает двигаться в ленте, как обычный пост.
              </p>
            </div>

            {price('ad_price_telegram') > 0 && (
              <div className={styles.section}>
                <h2>Реклама в Telegram</h2>
                <div className={styles.priceList}>
                  <div className={styles.priceItem}>
                    <span className={styles.priceLabel}>Рассылка всем пользователям</span>
                    <span className={styles.priceValue}>{price('ad_price_telegram')} {renderCurrency()}</span>
                  </div>
                  {price('ad_price_tg_repeat') > 0 && (
                    <div className={styles.priceItem}>
                      <span className={styles.priceLabel}>Повторения в ТГ</span>
                      <span className={styles.priceValue}>{price('ad_price_tg_repeat')} {renderCurrency()}</span>
                    </div>
                  )}
                  {price('ad_price_tg_interval') > 0 && (
                    <div className={styles.priceItem}>
                      <span className={styles.priceLabel}>Интервал повторений в ТГ</span>
                      <span className={styles.priceValue}>{price('ad_price_tg_interval')} {renderCurrency()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== Калькулятор ===== */}
            <div className={styles.section}>
              <h2>Калькулятор заказа</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Выберите каналы и укажите количество:
              </p>

              <div className={styles.calcChannels}>
                <label className={styles.calcCheckbox}>
                  <input type="checkbox" checked={channelSite} onChange={e => { setChannelSite(e.target.checked); if (!e.target.checked) { setSitePinQty(0); setSiteRepeatQty(0); setSiteInterval(0); setAutoDeleteOff(false); } }} />
                  <span>Реклама на сайте</span>
                </label>
                <label className={styles.calcCheckbox}>
                  <input type="checkbox" checked={channelTg} onChange={e => { setChannelTg(e.target.checked); if (!e.target.checked) { setTgMailingQty(0); setTgRepeatQty(0); setTgInterval(0); } }} />
                  <span>Реклама в Telegram</span>
                </label>
              </div>

              {channelSite && (
                <div className={styles.calcSection}>
                  <h3>Реклама на сайте</h3>
                  {price('ad_price_site') > 0 && (
                    <div className={styles.calcRow}>
                      <label>Показы в закреплённых:</label>
                      <input type="number" min="0" max="100" value={sitePinQty} onChange={e => setSitePinQty(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} />
                      <span className={styles.calcPrice}>{sitePinCost} {renderCurrency()}</span>
                    </div>
                  )}
                  {price('ad_price_repeat') > 0 && (
                    <div className={styles.calcRow}>
                      <label>Повторения:</label>
                      <input type="number" min="0" max="100" value={siteRepeatQty} onChange={e => setSiteRepeatQty(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} disabled={sitePinQty === 0} />
                      <span className={styles.calcPrice} style={{ color: 'var(--text-tertiary)' }}>{sitePinQty === 0 ? 'выберите показы' : siteRepeatCost + ' ' + sym}</span>
                    </div>
                  )}
                  <div className={styles.calcRow}>
                    <label>Интервал (часы):</label>
                    <input type="number" min="0" max="100" value={siteInterval} onChange={e => setSiteInterval(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} disabled={siteRepeatQty === 0} />
                    <span className={styles.calcPrice} style={{ color: 'var(--text-tertiary)' }}>{siteRepeatQty === 0 ? 'выберите повторения' : 'бесплатно'}</span>
                  </div>
                  {price('ad_price_auto_delete_off') > 0 && (
                    <div className={styles.calcRow}>
                      <label className={styles.calcCheckbox}>
                        <input type="checkbox" checked={autoDeleteOff} onChange={e => setAutoDeleteOff(e.target.checked)} disabled={sitePinQty === 0} />
                        <span>Отключение автоудаления</span>
                      </label>
                      <span className={styles.calcPrice}>{autoDeleteOffCost} {renderCurrency()}</span>
                    </div>
                  )}
                </div>
              )}

              {channelTg && (
                <div className={styles.calcSection}>
                  <h3>Реклама в Telegram</h3>
                  {price('ad_price_telegram') > 0 && (
                    <div className={styles.calcRow}>
                      <label>Рассылка:</label>
                      <input type="number" min="0" max="100" value={tgMailingQty} onChange={e => setTgMailingQty(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} />
                      <span className={styles.calcPrice}>{tgMailingCost} {renderCurrency()}</span>
                    </div>
                  )}
                  {price('ad_price_tg_repeat') > 0 && (
                    <div className={styles.calcRow}>
                      <label>Повторения:</label>
                      <input type="number" min="0" max="100" value={tgRepeatQty} onChange={e => setTgRepeatQty(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} disabled={tgMailingQty === 0} />
                      <span className={styles.calcPrice} style={{ color: 'var(--text-tertiary)' }}>{tgMailingQty === 0 ? 'выберите рассылку' : tgRepeatCost + ' ' + sym}</span>
                    </div>
                  )}
                  <div className={styles.calcRow}>
                    <label>Интервал (часы):</label>
                    <input type="number" min="0" max="100" value={tgInterval} onChange={e => setTgInterval(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} disabled={tgRepeatQty === 0} />
                    <span className={styles.calcPrice} style={{ color: 'var(--text-tertiary)' }}>{tgRepeatQty === 0 ? 'выберите повторения' : 'бесплатно'}</span>
                  </div>
                </div>
              )}

              {(channelSite || channelTg) && (
                <div className={styles.calcTotal}>
                  <span>Итого:</span>
                  <strong>{total} {renderCurrency()}</strong>
                </div>
              )}

              {(channelSite || channelTg) && (
                <div className={styles.calcButtons}>
                  <button onClick={handleCopy} className={styles.calcCopyBtn}>Скопировать</button>
                  <button onClick={handleSendTg} className={styles.calcSendBtn} disabled={sendingTg || !user?.telegramId}>
                    {sendingTg ? 'Отправка...' : 'Отправить запрос в ТГ'}
                  </button>
                </div>
              )}

              {sendResult && <p className={styles.sendResult}>{sendResult}</p>}
            </div>

            {/* ===== Информация ===== */}
            {infoContent && infoContent.replace(/<[^>]*>/g, '').trim() && (
              <div className={styles.section}>
                <h2>{infoTitle || 'Информация'}</h2>
                <div className={styles.infoContent} dangerouslySetInnerHTML={{ __html: infoContent }} />
              </div>
            )}

            {/* ===== Контакты ===== */}
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
