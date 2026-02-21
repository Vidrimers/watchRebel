import React, { useState } from 'react';
import UserPageLayout from '../components/Layout/UserPageLayout';
import ConversationList from '../components/Messages/ConversationList';
import MessageThread from '../components/Messages/MessageThread';
import styles from './MessagesPage.module.css';

/**
 * Страница сообщений
 * Отображает список диалогов и окно переписки
 */
const MessagesPage = () => {
  const [selectedConversation, setSelectedConversation] = useState(null);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  return (
    <UserPageLayout>
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
