import { useState, useEffect } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import useAlert from '../hooks/useAlert';
import Icon from '../components/Common/Icon';
import api from '../services/api';
import styles from './PricingPage.module.css';

const PricingPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { alertDialog, showAlert } = useAlert();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoContent, setInfoContent] = useState('');

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

  // Модалка заявки
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: '', telegram: '', extraContact: '', adDescription: '', adLink: '', adLinkLabel: '', adText: '', scheduledAt: '' });
  const [requestImage, setRequestImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

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

  const handleSubmitRequest = async () => {
    if (!requestForm.name.trim() || !requestForm.telegram.trim()) {
      setSubmitResult('Заполните имя и Telegram');
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('name', requestForm.name.trim());
      fd.append('telegram', requestForm.telegram.trim());
      fd.append('extraContact', requestForm.extraContact.trim());
      fd.append('calculatorData', JSON.stringify({
        channelSite, channelTg,
        sitePinQty, siteRepeatQty, siteInterval,
        tgMailingQty, tgRepeatQty, tgInterval,
        autoDeleteOff, total, currency,
        scheduledAt: requestForm.scheduledAt || null
      }));
      fd.append('adDescription', requestForm.adDescription.trim());
      fd.append('adLink', requestForm.adLink.trim());
      fd.append('adLinkLabel', requestForm.adLinkLabel.trim());
      fd.append('adText', requestForm.adText.trim());
      if (requestImage) fd.append('image', requestImage);

      await api.post('/ad-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowRequestModal(false);
      setRequestForm({ name: '', telegram: '', extraContact: '', adDescription: '', adLink: '', adLinkLabel: '', adText: '', scheduledAt: '' });
      setRequestImage(null);
      setSubmitResult(null);
      await showAlert({ title: 'Заявка отправлена', message: 'Мы свяжемся с вами в ближайшее время!', type: 'success' });
    } catch (err) {
      setSubmitResult('Ошибка отправки. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRequestModal = () => {
    setShowRequestModal(true);
    api.post('/ad-requests/notify-open').catch(() => {});
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
                      <span className={styles.calcPrice} style={sitePinQty === 0 ? { color: 'var(--text-tertiary)' } : undefined}>{sitePinQty === 0 ? 'выберите показы' : siteRepeatCost + ' ' + sym}</span>
                    </div>
                  )}
                  <div className={styles.calcRow}>
                    <label>Интервал (часы):</label>
                    <input type="number" min="0" max="100" value={siteInterval} onChange={e => setSiteInterval(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} disabled={siteRepeatQty === 0} />
                    <span className={styles.calcPrice} style={siteRepeatQty === 0 ? { color: 'var(--text-tertiary)' } : undefined}>{siteRepeatQty === 0 ? 'выберите повторения' : 'бесплатно'}</span>
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
                      <span className={styles.calcPrice} style={tgMailingQty === 0 ? { color: 'var(--text-tertiary)' } : undefined}>{tgMailingQty === 0 ? 'выберите рассылку' : tgRepeatCost + ' ' + sym}</span>
                    </div>
                  )}
                  <div className={styles.calcRow}>
                    <label>Интервал (часы):</label>
                    <input type="number" min="0" max="100" value={tgInterval} onChange={e => setTgInterval(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className={styles.calcInput} disabled={tgRepeatQty === 0} />
                    <span className={styles.calcPrice} style={tgRepeatQty === 0 ? { color: 'var(--text-tertiary)' } : undefined}>{tgRepeatQty === 0 ? 'выберите повторения' : 'бесплатно'}</span>
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
                  <button onClick={handleOpenRequestModal} className={styles.calcRequestBtn}>Оставить заявку</button>
                </div>
              )}
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

      {/* Модалка заявки на рекламу */}
      {showRequestModal && (
        <div className={styles.requestModal} onClick={() => { if (!submitting) { setShowRequestModal(false); setSubmitResult(null); } }}>
          <div className={styles.requestModalContent} onClick={e => e.stopPropagation()}>
            <h3>Заявка на рекламу</h3>
            <div className={styles.requestForm}>
              <div className={styles.formGroup}>
                <label>Имя *</label>
                <input type="text" value={requestForm.name} onChange={e => setRequestForm(p => ({ ...p, name: e.target.value }))} className={styles.formInput} placeholder="Ваше имя" disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Telegram *</label>
                <input type="text" value={requestForm.telegram} onChange={e => setRequestForm(p => ({ ...p, telegram: e.target.value }))} className={styles.formInput} placeholder="@username" disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Доп. способ связи</label>
                <input type="text" value={requestForm.extraContact} onChange={e => setRequestForm(p => ({ ...p, extraContact: e.target.value }))} className={styles.formInput} placeholder="Телефон, Discord и т.д." disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Описание рекламы, доп. информация</label>
                <textarea value={requestForm.adDescription} onChange={e => setRequestForm(p => ({ ...p, adDescription: e.target.value }))} className={styles.formTextarea} placeholder="Что нужно продвинуть?" rows={5} disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Ссылка на сайт/ТГ</label>
                <input type="text" value={requestForm.adLink} onChange={e => setRequestForm(p => ({ ...p, adLink: e.target.value }))} className={styles.formInput} placeholder="https://..." disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Текст ссылки: <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(будет отображаться вместо ссылки)</span></label>
                <input type="text" value={requestForm.adLinkLabel} onChange={e => setRequestForm(p => ({ ...p, adLinkLabel: e.target.value }))} className={styles.formInput} placeholder="Например: Перейти на сайт" disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Текст поста</label>
                <textarea value={requestForm.adText} onChange={e => setRequestForm(p => ({ ...p, adText: e.target.value }))} className={styles.formTextarea} placeholder="Текст рекламного поста..." rows={10} disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Дата публикации (необязательно)</label>
                <input type="datetime-local" value={requestForm.scheduledAt} onChange={e => setRequestForm(p => ({ ...p, scheduledAt: e.target.value }))} className={styles.formInput} disabled={submitting} />
              </div>
              <div className={styles.formGroup}>
                <label>Изображение (необязательно)</label>
                <input type="file" accept="image/*" onChange={e => setRequestImage(e.target.files?.[0] || null)} className={styles.formInput} disabled={submitting} />
                {requestImage && <p className={styles.imageName}>{requestImage.name}</p>}
              </div>
              <div className={styles.formButtons}>
                <button onClick={handleSubmitRequest} className={styles.submitBtn} disabled={submitting || !requestForm.name.trim() || !requestForm.telegram.trim()}>
                  {submitting ? 'Отправка...' : 'Отправить'}
                </button>
                <button onClick={() => { setShowRequestModal(false); setSubmitResult(null); }} className={styles.cancelBtn} disabled={submitting}>Отмена</button>
              </div>
              {submitResult && submitResult !== 'ok' && <p className={styles.submitError}>{submitResult}</p>}
            </div>
          </div>
        </div>
      )}
      {alertDialog}
    </div>
  );
};

export default PricingPage;
