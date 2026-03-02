import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchConversations } from '../store/slices/messagesSlice';
import UserPageLayout from '../components/Layout/UserPageLayout';
import ConversationList from '../components/Messages/ConversationList';
import MessageThread from '../components/Messages/MessageThread';
import api from '../services/api';
import styles from './MessagesPage.module.css';

/**
 * Страница сообщений
 * Отображает список диалогов и окно переписки
 */
const MessagesPage = () => {
  const { userId } = useParams();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { conversations } = useAppSelector((state) => state.messages);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  // Загружаем список диалогов при монтировании
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // Если передан userId в URL, проверяем существующие диалоги или создаем новый
  useEffect(() => {
    const loadUserAndCreateConversation = async () => {
      if (!userId || conversations.length === 0) return;
      
      // Проверяем, есть ли уже диалог с этим пользователем
      const existingConversation = conversations.find(
        conv => conv.otherUser.id === userId
      );

      if (existingConversation) {
        // Если диалог существует - открываем его
        setSelectedConversation(existingConversation);
        return;
      }

      // Если диалога нет - загружаем данные пользователя и создаем новый
      try {
        setLoadingUser(true);
        const response = await api.get(`/users/${userId}`);
        const otherUser = response.data;
        
        // Создаем объект conversation для нового диалога
        setSelectedConversation({
          id: null, // null означает новый диалог
          otherUser: {
            id: otherUser.id,
            displayName: otherUser.displayName,
            avatarUrl: otherUser.avatarUrl
          }
        });
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        alert('Не удалось загрузить данные пользователя');
      } finally {
        setLoadingUser(false);
      }
    };

    loadUserAndCreateConversation();
  }, [userId, conversations]);

  if (loadingUser) {
    return (
      <UserPageLayout user={user}>
        <div className={styles.container}>
          <div className={styles.conversationListPanel}>
            <ConversationList onSelectConversation={handleSelectConversation} />
          </div>
          <div className={styles.messageThreadPanel}>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              Загрузка...
            </div>
          </div>
        </div>
      </UserPageLayout>
    );
  }

  return (
    <UserPageLayout user={user}>
      <div className={styles.container}>
        <div className={styles.conversationListPanel}>
          <ConversationList onSelectConversation={handleSelectConversation} />
        </div>
        <div className={styles.messageThreadPanel}>
          <MessageThread conversation={selectedConversation} />
        </div>
      </div>
    </UserPageLayout>
  );
};

export default MessagesPage;
