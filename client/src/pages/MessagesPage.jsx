import React, { useState } from 'react';
import { useAppSelector } from '../hooks/useAppSelector';
import UserPageLayout from '../components/Layout/UserPageLayout';
import ConversationList from '../components/Messages/ConversationList';
import MessageThread from '../components/Messages/MessageThread';
import styles from './MessagesPage.module.css';

/**
 * Страница сообщений
 * Отображает список диалогов и окно переписки
 */
const MessagesPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [selectedConversation, setSelectedConversation] = useState(null);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

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
