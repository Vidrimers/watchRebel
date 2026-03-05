import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Хук для реализации infinite scroll (бесконечной прокрутки)
 * 
 * @param {Function} fetchFunction - Функция загрузки данных, принимает (limit, offset)
 * @param {number} initialLimit - Начальный лимит (по умолчанию 20)
 * @returns {Object} - { items, loading, hasMore, loadMore, refresh, error }
 */
const useInfiniteScroll = (fetchFunction, initialLimit = 20) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);
  const limit = initialLimit;
  const isInitialMount = useRef(true);

  // Загрузка данных
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchFunction(limit, offset);
      
      // Проверяем формат ответа
      const newItems = response.posts || response.data?.posts || response;
      const responseHasMore = response.hasMore !== undefined 
        ? response.hasMore 
        : (response.data?.hasMore !== undefined ? response.data.hasMore : newItems.length === limit);

      setItems(prev => [...prev, ...newItems]);
      setHasMore(responseHasMore);
      setOffset(prev => prev + limit);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err.response?.data?.error || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, limit, offset, loading, hasMore]);

  // Обновление (сброс и загрузка заново)
  const refresh = useCallback(async () => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    
    try {
      setLoading(true);
      const response = await fetchFunction(limit, 0);
      
      const newItems = response.posts || response.data?.posts || response;
      const responseHasMore = response.hasMore !== undefined 
        ? response.hasMore 
        : (response.data?.hasMore !== undefined ? response.data.hasMore : newItems.length === limit);

      setItems(newItems);
      setHasMore(responseHasMore);
      setOffset(limit);
    } catch (err) {
      console.error('Ошибка обновления данных:', err);
      setError(err.response?.data?.error || 'Не удалось обновить данные');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, limit]);

  // Автоматическая загрузка при скролле
  useEffect(() => {
    const handleScroll = () => {
      // Проверяем достигли ли мы конца страницы (с запасом 300px)
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollTop + clientHeight >= scrollHeight - 300 && !loading && hasMore) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loading, hasMore]);

  // Начальная загрузка
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadMore();
    }
  }, []);

  return {
    items,
    loading,
    hasMore,
    loadMore,
    refresh,
    error
  };
};

export default useInfiniteScroll;
