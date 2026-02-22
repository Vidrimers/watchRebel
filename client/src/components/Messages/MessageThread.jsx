import React, { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchMessages, sendMessage, deleteMessage } from '../../store/slices/messagesSlice';
import { addMessageHandler, removeMessageHandler } from '../../services/websocket';
import useConfirm from '../../hooks/useConfirm';
import styles from './MessageThread.module.css';

/**
 * Окно переписки
 * Отображает сообщения в выбранном диалоге и позволяет отправлять новые
 */
const MessageThread = ({ conversation }) => {
  const dispatch = useAppDispatch();
  const { messages, loading, loadingMore, hasMoreMessages, sendingMessage } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [modalImages, setModalImages] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ natural: { width: 0, height: 0 }, displayed: { width: 0, height: 0 } });

  // Загружаем сообщения при выборе диалога
  useEffect(() => {
    if (conversation && conversation.id) {
      dispatch(fetchMessages({ conversationId: conversation.id, limit: 50, offset: 0 }));
      
      // Fallback: polling если WebSocket не работает (например через ngrok)
      const pollInterval = setInterval(() => {
        // Проверяем только если не получили сообщение через WebSocket недавно
        dispatch(fetchMessages({ conversationId: conversation.id, limit: 50, offset: 0 }));
      }, 5000); // Проверяем каждые 5 секунд
      
      return () => clearInterval(pollInterval);
    }
  }, [conversation, dispatch]);

  // Подключаем обработчик WebSocket сообщений
  useEffect(() => {
    // Обработчик новых сообщений через WebSocket
    const handleWebSocketMessage = (data) => {
      if (data.type === 'new_message' && data.message) {
        // Добавляем новое сообщение в Redux store
        dispatch({ 
          type: 'messages/addNewMessage', 
          payload: data.message 
        });
      }
    };

    addMessageHandler(handleWebSocketMessage);

    return () => {
      removeMessageHandler(handleWebSocketMessage);
    };
  }, [dispatch]);

  // Показываем кнопку скролла вниз при появлении новых сообщений
  useEffect(() => {
    if (messages.length === 0) return;
    
    const currentLastMessage = messages[messages.length - 1];
    const currentLastMessageId = currentLastMessage?.id;
    
    // Если ID последнего сообщения изменился - значит пришло новое
    if (lastMessageId && currentLastMessageId !== lastMessageId) {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        
        // Проверяем последнее сообщение - от меня или нет
        const isMyMessage = currentLastMessage?.senderId === user?.id;
        
        if (isMyMessage) {
          // Если я отправил - всегда скроллим
          scrollToBottom();
        } else if (isNearBottom) {
          // Если пришло от другого и я внизу - скроллим
          scrollToBottom();
        } else {
          // Если пришло от другого и я НЕ внизу - показываем кнопку
          setShowScrollButton(true);
        }
      }
    }
    
    // Обновляем lastMessageId только если он действительно изменился
    if (currentLastMessageId !== lastMessageId) {
      setLastMessageId(currentLastMessageId);
    }
  }, [messages.length, user?.id]); // Убрал messages и lastMessageId из зависимостей

  // Обработчик скролла для определения когда загружать старые сообщения
  const handleScroll = (e) => {
    const container = e.target;
    
    // Если проскроллили в самый верх и есть еще сообщения
    if (container.scrollTop === 0 && hasMoreMessages && !loadingMore) {
      loadOlderMessages();
    }
  };

  // Загрузка старых сообщений
  const loadOlderMessages = async () => {
    if (!conversation || !conversation.id || loadingMore) return;
    
    const container = messagesContainerRef.current;
    const previousScrollHeight = container.scrollHeight;
    
    await dispatch(fetchMessages({ 
      conversationId: conversation.id, 
      limit: 50, 
      offset: messages.length 
    }));
    
    // Сохраняем позицию скролла после загрузки
    setTimeout(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - previousScrollHeight;
    }, 0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  // Обработчик отправки сообщения
  const handleSendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('📤 Отправка сообщения:', { 
      hasText: !!messageText.trim(), 
      filesCount: selectedFiles.length,
      sendingMessage 
    });
    
    if ((!messageText.trim() && selectedFiles.length === 0) || sendingMessage) {
      console.log('⚠️ Отправка отменена: нет контента или уже отправляется');
      return;
    }

    const content = messageText.trim();
    const files = selectedFiles;
    
    setMessageText('');
    setSelectedFiles([]);

    try {
      const result = await dispatch(sendMessage({
        receiverId: conversation.otherUser.id,
        content,
        files
      }));

      console.log('✅ Сообщение отправлено:', result);

      // Если это новый диалог (id === null), обновляем список диалогов
      if (conversation.id === null && result.meta.requestStatus === 'fulfilled') {
        // Диалог будет автоматически добавлен в список через fetchConversations
        // который вызывается в ConversationList при монтировании
      }
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error);
      // Возвращаем файлы обратно при ошибке
      setSelectedFiles(files);
      setMessageText(content);
    }
  };

  // Обработчик выбора файлов
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        alert(`Файл ${file.name} слишком большой. Максимум 50МБ`);
        return false;
      }
      return true;
    });
    
    if (selectedFiles.length + validFiles.length > 10) {
      alert('Максимум 10 файлов за раз');
      return;
    }
    
    setSelectedFiles([...selectedFiles, ...validFiles]);
  };

  // Удаление файла из списка
  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  // Открытие галереи изображений
  const handleImageClick = (attachments, index) => {
    const images = attachments.filter(att => att.mimetype.startsWith('image/'));
    setModalImages(images);
    setCurrentImageIndex(index);
    setShowImageModal(true);
    setImageDimensions({ natural: { width: 0, height: 0 }, displayed: { width: 0, height: 0 } });
  };

  // Обновление размеров изображения
  const handleImageLoad = (e) => {
    const img = e.target;
    if (img && img.naturalWidth && img.naturalHeight) {
      setImageDimensions({
        natural: { width: img.naturalWidth, height: img.naturalHeight },
        displayed: { width: Math.round(img.width), height: Math.round(img.height) }
      });
    }
  };

  // Обработчик нажатия Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Обработчик удаления сообщения
  const handleDeleteMessage = async (messageId) => {
    const confirmed = await showConfirm({
      title: 'Удалить сообщение',
      message: 'Вы уверены, что хотите удалить это сообщение?',
      confirmText: 'Удалить',
      cancelText: 'Отмена'
    });
    
    if (confirmed) {
      dispatch(deleteMessage(messageId));
    }
  };

  // Форматирование времени
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Форматирование даты для разделителя
  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Проверка, нужен ли разделитель даты
  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage) return true;
    
    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();
    
    return currentDate !== previousDate;
  };

  if (!conversation) {
    return (
      <>
        {confirmDialog}
        <div className={styles.container}>
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>💬</span>
            <p>Выберите диалог для начала переписки</p>
          </div>
        </div>
      </>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <>
        {confirmDialog}
        <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerAvatar}>
            {conversation.otherUser.avatarUrl ? (
              <>
                <img 
                  src={
                    conversation.otherUser.avatarUrl.startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                      : conversation.otherUser.avatarUrl
                  }
                  alt={conversation.otherUser.displayName}
                  className={styles.headerAvatarImage}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div 
                  className={styles.headerAvatarPlaceholder}
                  style={{ display: 'none' }}
                >
                  {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                </div>
              </>
            ) : (
              <div className={styles.headerAvatarPlaceholder}>
                {conversation.otherUser.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className={styles.headerName}>{conversation.otherUser.displayName}</h2>
        </div>
        <div className={styles.loading}>Загрузка сообщений...</div>
      </div>
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className={styles.container}>
      {/* Шапка с информацией о собеседнике */}
      <div className={styles.header}>
        <div className={styles.headerAvatar}>
          {conversation.otherUser.avatarUrl ? (
            <img 
              src={
                conversation.otherUser.avatarUrl.startsWith('/uploads/')
                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                  : conversation.otherUser.avatarUrl
              }
              alt={conversation.otherUser.displayName}
              className={styles.headerAvatarImage}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={styles.headerAvatarPlaceholder}
            style={{ display: conversation.otherUser.avatarUrl ? 'none' : 'flex' }}
          >
            {conversation.otherUser.displayName.charAt(0).toUpperCase()}
          </div>
        </div>
        <h2 className={styles.headerName}>{conversation.otherUser.displayName}</h2>
      </div>

      {/* Список сообщений */}
      <div 
        className={styles.messagesContainer} 
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <p>Начните переписку с {conversation.otherUser.displayName}</p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {loadingMore && (
              <div className={styles.loadingMore}>Загрузка старых сообщений...</div>
            )}
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === user.id;
              const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className={styles.dateSeparator}>
                      {formatDateSeparator(message.createdAt)}
                    </div>
                  )}
                  
                  <div className={`${styles.message} ${isOwnMessage ? styles.ownMessage : styles.otherMessage}`}>
                    <div className={styles.messageAvatar}>
                      {isOwnMessage ? (
                        user.avatarUrl ? (
                          <>
                            <img 
                              src={
                                user.avatarUrl.startsWith('/uploads/')
                                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${user.avatarUrl}`
                                  : user.avatarUrl
                              }
                              alt={user.displayName}
                              className={styles.messageAvatarImage}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div 
                              className={styles.messageAvatarPlaceholder}
                              style={{ display: 'none' }}
                            >
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          </>
                        ) : (
                          <div className={styles.messageAvatarPlaceholder}>
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )
                      ) : (
                        conversation.otherUser.avatarUrl ? (
                          <>
                            <img 
                              src={
                                conversation.otherUser.avatarUrl.startsWith('/uploads/')
                                  ? `${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${conversation.otherUser.avatarUrl}`
                                  : conversation.otherUser.avatarUrl
                              }
                              alt={conversation.otherUser.displayName}
                              className={styles.messageAvatarImage}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div 
                              className={styles.messageAvatarPlaceholder}
                              style={{ display: 'none' }}
                            >
                              {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                            </div>
                          </>
                        ) : (
                          <div className={styles.messageAvatarPlaceholder}>
                            {conversation.otherUser.displayName.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>
                    
                    <div className={styles.messageBubble}>
                      {message.content && (
                        <p className={styles.messageText}>{message.content}</p>
                      )}
                      
                      {/* Вложения */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className={styles.attachments}>
                          {message.attachments.map((attachment, attIndex) => (
                            <div key={attIndex} className={styles.attachment}>
                              {attachment.mimetype.startsWith('image/') ? (
                                <img
                                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${attachment.path}`}
                                  alt={attachment.originalName}
                                  className={styles.attachmentImage}
                                  onClick={() => handleImageClick(message.attachments, attIndex)}
                                />
                              ) : (
                                <a
                                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${attachment.path}`}
                                  download={attachment.originalName}
                                  className={styles.attachmentFile}
                                >
                                  <span className={styles.attachmentIcon}>📄</span>
                                  <span className={styles.attachmentName}>{attachment.originalName}</span>
                                  <span className={styles.attachmentSize}>
                                    {(attachment.size / 1024 / 1024).toFixed(2)} МБ
                                  </span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {message.sentViaBot && (
                        <div className={styles.botLabel}>
                          📱 Отвечено с помощью бота
                        </div>
                      )}
                      <div className={styles.messageFooter}>
                        <span className={styles.messageTime}>{formatTime(message.createdAt)}</span>
                        {isOwnMessage && (
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDeleteMessage(message.id)}
                            title="Удалить сообщение"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Кнопка скролла вниз */}
        {showScrollButton && (
          <button 
            className={styles.scrollDownButton}
            onClick={scrollToBottom}
            title="К новым сообщениям"
          >
            ↓
          </button>
        )}
      </div>

      {/* Форма отправки сообщения */}
      <form className={styles.inputForm} onSubmit={handleSendMessage}>
        <div className={styles.inputWrapper}>
          {/* Превью выбранных файлов */}
          {selectedFiles.length > 0 && (
            <div className={styles.filesPreview}>
              {selectedFiles.map((file, index) => (
                <div key={index} className={styles.filePreviewItem}>
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className={styles.filePreviewImage}
                    />
                  ) : (
                    <div className={styles.filePreviewIcon}>📄</div>
                  )}
                  <span className={styles.filePreviewName}>{file.name}</span>
                  <button
                    type="button"
                    className={styles.fileRemoveButton}
                    onClick={() => handleRemoveFile(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className={styles.inputRow}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="*/*"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className={styles.attachButton}
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить файл"
            >
              📎
            </button>
            <textarea
              className={styles.input}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              rows={1}
              disabled={sendingMessage}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={(!messageText.trim() && selectedFiles.length === 0) || sendingMessage}
            >
              {sendingMessage ? '...' : '➤'}
            </button>
          </div>
        </div>
      </form>
      
      {/* Модалка для просмотра изображений */}
      {showImageModal && (
        <div className={styles.imageModal} onClick={() => setShowImageModal(false)}>
          <div className={styles.imageModalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.imageModalClose}
              onClick={() => setShowImageModal(false)}
            >
              ×
            </button>
            
            {modalImages.length > 1 && (
              <>
                <button
                  className={styles.imageModalPrev}
                  onClick={() => setCurrentImageIndex((currentImageIndex - 1 + modalImages.length) % modalImages.length)}
                >
                  ‹
                </button>
                <button
                  className={styles.imageModalNext}
                  onClick={() => setCurrentImageIndex((currentImageIndex + 1) % modalImages.length)}
                >
                  ›
                </button>
              </>
            )}
            
            <img
              src={`${import.meta.env.VITE_API_URL || 'http://localhost:1313'}${modalImages[currentImageIndex]?.path}`}
              alt={modalImages[currentImageIndex]?.originalName}
              className={styles.imageModalImage}
              onLoad={handleImageLoad}
            />
            
            <div className={styles.imageModalInfo}>
              {imageDimensions.natural.width > 0 && (
                <div className={styles.imageModalDimensions}>
                  Реальный размер: {imageDimensions.natural.width}×{imageDimensions.natural.height} | 
                  Текущий размер: {imageDimensions.displayed.width}×{imageDimensions.displayed.height}
                </div>
              )}
              {modalImages.length > 1 && (
                <div className={styles.imageModalCounter}>
                  {currentImageIndex + 1} / {modalImages.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default MessageThread;
