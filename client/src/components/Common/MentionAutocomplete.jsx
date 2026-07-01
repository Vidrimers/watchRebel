import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import api from '../../services/api';
import styles from './MentionAutocomplete.module.css';

const MentionAutocomplete = ({ textareaRef, onMentionSelect, onTextChange, position = 'top' }) => {
  const { user } = useAppSelector((state) => state.auth);
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const dropdownRef = useRef(null);

  const searchFriends = useCallback(async (q) => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.get(`/users/${user.id}/friends/search?q=${encodeURIComponent(q)}`);
      setFriends(response.data);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Ошибка поиска друзей:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Обработка ввода в textarea
  useEffect(() => {
    const textarea = textareaRef?.current;
    if (!textarea) return;

    const handleInput = () => {
      const value = textarea.value;
      const cursorPos = textarea.selectionStart;

      // Ищем @ перед курсором
      const textBeforeCursor = value.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex >= 0) {
        // Проверяем что перед @ пробел или начало строки
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
          const queryText = textBeforeCursor.substring(lastAtIndex + 1);
          // Проверяем что в query нет пробелов (только одно слово)
          if (!queryText.includes(' ') && queryText.length <= 30) {
            setMentionStart(lastAtIndex);
            setQuery(queryText);
            setShowDropdown(true);
            searchFriends(queryText);
            return;
          }
        }
      }

      setShowDropdown(false);
      setMentionStart(-1);
    };

    textarea.addEventListener('input', handleInput);
    return () => textarea.removeEventListener('input', handleInput);
  }, [textareaRef, searchFriends]);

  // Навигация по списку
  useEffect(() => {
    const textarea = textareaRef?.current;
    if (!textarea) return;

    const handleKeyDown = (e) => {
      if (!showDropdown || friends.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, friends.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && showDropdown) {
        e.preventDefault();
        selectMention(friends[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, friends, selectedIndex, textareaRef]);

  const selectMention = (friend) => {
    const textarea = textareaRef?.current;
    if (!textarea || mentionStart < 0) return;

    const value = textarea.value;
    const beforeMention = value.substring(0, mentionStart);
    const afterCursor = value.substring(textarea.selectionStart);

    const mentionText = `@[${friend.displayName}](${friend.id})`;
    const newValue = beforeMention + mentionText + ' ' + afterCursor;

    textarea.value = newValue;
    textarea.selectionStart = textarea.selectionEnd = beforeMention.length + mentionText.length + 1;

    setShowDropdown(false);
    setMentionStart(-1);

    // Обновляем React state родителя
    onTextChange?.(newValue);
    onMentionSelect?.(friend);
  };

  if (!showDropdown) return null;

  return (
    <div
      ref={dropdownRef}
      className={`${styles.dropdown} ${position === 'bottom' ? styles.bottom : styles.top}`}
    >
      {loading ? (
        <div className={styles.loading}>Поиск...</div>
      ) : friends.length === 0 ? (
        <div className={styles.empty}>Ничего не найдено</div>
      ) : (
        friends.map((friend, index) => (
          <div
            key={friend.id}
            className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
            onClick={() => selectMention(friend)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className={styles.avatar}>
              {friend.avatarUrl ? (
                <img
                  src={
                    friend.avatarUrl.startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || ''}${friend.avatarUrl}`
                      : friend.avatarUrl
                  }
                  alt={friend.displayName}
                  className={styles.avatarImg}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {friend.displayName?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className={styles.name}>{friend.displayName}</span>
            {friend.telegramUsername && (
              <span className={styles.username}>@{friend.telegramUsername}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default MentionAutocomplete;
