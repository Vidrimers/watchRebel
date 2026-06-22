import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchMessages, sendMessage, deleteMessage } from '../../store/slices/messagesSlice';
import { addMessageHandler, removeMessageHandler } from '../../services/websocket';
import useConfirm from '../../hooks/useConfirm';
import useAlert from '../../hooks/useAlert';
import Icon from '../Common/Icon';
import ReportModal from '../Common/ReportModal';
import { resolveDisplayNameWithTooltip } from '../../utils/nicknameResolver';
import AttachmentDropdown from './AttachmentDropdown';
import SuggestMediaModal from './SuggestMediaModal';
import LocationModal from './LocationModal';
import RecordingOverlay from './RecordingOverlay';
import AudioPlayer from './AudioPlayer';
import DeleteMessagePopup from './DeleteMessagePopup';
import useAudioRecorder from '../../hooks/useAudioRecorder';
import api from '../../services/api';
import styles from './MessageThread.module.css';

const parseLocation = (loc) => {
  if (!loc) return null;
  if (typeof loc === 'string') {
    try { loc = JSON.parse(loc); } catch { return null; }
  }
  if (loc.lat !== undefined && loc.lng !== undefined) return loc;
  if (loc.latitude !== undefined && loc.longitude !== undefined) return { lat: loc.latitude, lng: loc.longitude };
  return null;
};

const parseSuggestedMedia = (sm) => {
  if (!sm) return null;
  if (typeof sm === 'string') {
    try { sm = JSON.parse(sm); } catch { return null; }
  }
  if (sm.tmdbId !== undefined) return sm;
  return null;
};

/**
 * Окно переписки
 * Отображает сообщения в выбранном диалоге и позволяет отправлять новые
 */
const MessageThread = ({ conversation, onClose }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { messages, loading, loadingMore, hasMoreMessages, sendingMessage } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);
  const { confirmDialog, showConfirm } = useConfirm();
  const { alertDialog, showAlert } = useAlert();
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAttachDropdown, setShowAttachDropdown] = useState(false);
  const [attachType, setAttachType] = useState('file');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestMediaType, setSuggestMediaType] = useState('movie');
  const attachFileInputRef = useRef(null);
  const attachImageInputRef = useRef(null);
  const menuRef = useRef(null);
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
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState(null);
  const [deleteMessageIsOwn, setDeleteMessageIsOwn] = useState(true);
  const [deletePopupPosition, setDeletePopupPosition] = useState(null);

  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioBuffer,
    analyserData,
    error: recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
    reset: resetRecording
  } = useAudioRecorder();

  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const showInput = !isRecording && !audioBlob;

  // Загружаем сообщения при выборе диалога
  useEffect(() => {
    if (conversation && conversation.id) {
      dispatch(fetchMessages({ conversationId: conversation.id, limit: 20, offset: 0 }));
    }
  }, [conversation, dispatch]);

  // Скролл вниз при загрузке сообщений в новом диалоге
  const prevConversationRef = useRef(null);
  const prevMessagesLenRef = useRef(0);
  useEffect(() => {
    // При смене диалога — сбрасываем счётчик
    if (conversation?.id !== prevConversationRef.current) {
      prevConversationRef.current = conversation?.id;
      prevMessagesLenRef.current = 0;
      return;
    }
    
    // Скроллим когда сообщения впервые загрузились (было 0, стало >0)
    if (messages.length > 0 && prevMessagesLenRef.current === 0) {
      prevMessagesLenRef.current = messages.length;
      // Мгновенный скролл — без анимации
      scrollToBottom(false);
    }
    
    prevMessagesLenRef.current = messages.length;
  }, [conversation?.id, messages.length]);

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
          // Если я отправил - всегда скроллим мгновенно
          scrollToBottom(false);
        } else if (isNearBottom) {
          // Если пришло от другого и я внизу - скроллим мгновенно
          scrollToBottom(false);
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

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Закрытие диалога по Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && conversation) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [conversation, onClose]);

  // Обработчик скролла для определения когда загружать старые сообщения
  const handleScroll = (e) => {
    const container = e.target;
    
    // Закрываем popup удаления при скролле
    if (showDeletePopup) {
      setShowDeletePopup(false);
      setDeleteMessageId(null);
    }
    
    // Если проскроллили в самый верх и есть еще сообщения
    if (container.scrollTop === 0 && hasMoreMessages && !loadingMore) {
      loadOlderMessages();
    }

    // Показываем/скрываем кнопку скролла вниз
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  };

  // Загрузка старых сообщений
  const loadOlderMessages = async () => {
    if (!conversation || !conversation.id || loadingMore) return;
    
    const container = messagesContainerRef.current;
    const previousScrollHeight = container.scrollHeight;
    
    await dispatch(fetchMessages({ 
      conversationId: conversation.id, 
      limit: 20, 
      offset: messages.length 
    }));
    
    // Сохраняем позицию скролла после загрузки
    setTimeout(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - previousScrollHeight;
    }, 0);
  };

  // Отправка геометки
  const handleSendLocation = async (data) => {
    try {
      await dispatch(sendMessage({
        receiverId: conversation.otherUser.id,
        content: `📍 ${data.latitude}, ${data.longitude}`,
        files: [],
        location: { lat: data.latitude, lng: data.longitude }
      }));
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  // Отправка предложенного медиа
  const handleSendSuggestedMedia = async (data) => {
    try {
      await dispatch(sendMessage({
        receiverId: conversation.otherUser.id,
        content: `🎬 ${data.title}`,
        files: [],
        suggestedMedia: {
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
          title: data.title,
          posterPath: data.posterPath,
          voteAverage: data.voteAverage
        }
      }));
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  // Блокировка пользователя
  // Обработка выбора типа вложения
  const handleAttachmentSelect = (type) => {
    setShowAttachDropdown(false);
    setAttachType(type);
    
    switch (type) {
      case 'file':
        attachFileInputRef.current?.click();
        break;
      case 'image':
        attachImageInputRef.current?.click();
        break;
      case 'location':
        setShowLocationModal(true);
        break;
      case 'suggest_movie':
        setShowSuggestModal(true);
        setSuggestMediaType('movie');
        break;
      case 'suggest_series':
        setShowSuggestModal(true);
        setSuggestMediaType('tv');
        break;
    }
  };

  const handleBlockUser = async () => {
    setShowMenu(false);
    const confirmed = await showConfirm({
      title: 'Заблокировать пользователя?',
      message: `Вы уверены, что хотите заблокировать ${conversation.otherUser.displayName}? Вы не будете видеть его сообщения.`,
      confirmText: 'Заблокировать',
      cancelText: 'Отмена',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.post(`/users/${conversation.otherUser.id}/block`);
      await showAlert({
        title: 'Пользователь заблокирован',
        message: `${conversation.otherUser.displayName} заблокирован`,
        type: 'success'
      });
      navigate('/messages');
    } catch (error) {
      await showAlert({
        title: 'Ошибка',
        message: error.response?.data?.error || 'Не удалось заблокировать пользователя',
        type: 'error'
      });
    }
  };

  const scrollToBottom = (animated = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    setShowScrollButton(false);
    
    const end = container.scrollHeight - container.clientHeight;
    
    if (!animated) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    
    const start = container.scrollTop;
    const distance = end - start;
    
    if (distance <= 5) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    
    const duration = 600;
    let startTime = null;
    
    const easeInQuad = (t) => t * t;
    
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInQuad(progress);
      
      container.scrollTop = start + distance * easedProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
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

  // Отправка аудиосообщения
  const handleSendAudio = async () => {
    if (!audioBlob || sendingMessage) return;
    
    const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: audioBlob.type });
    
    try {
      await dispatch(sendMessage({
        receiverId: conversation.otherUser.id,
        content: '',
        files: [file]
      }));
      resetRecording();
    } catch (error) {
      console.error('Ошибка отправки аудио:', error);
    }
  };

  // Обработчики кнопки записи (длинное нажатие = запись)
  const handleRecordMouseDown = () => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      startRecording();
    }, 300);
  };

  const handleRecordMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
    } else {
      // Короткое нажатие — ничего (остаёмся в текстовом режиме)
    }
  };

  const handleRecordTouchStart = (e) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      startRecording();
    }, 300);
  };

  const handleRecordTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
    }
  };

  // Определяем, нужно ли показывать кнопку записи
  const hasContent = messageText.trim() || selectedFiles.length > 0;

  // Обработчик удаления сообщения — показ popup над крестиком
  const handleDeleteClick = (e, messageId, isOwn) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    
    setDeleteMessageId(messageId);
    setDeleteMessageIsOwn(isOwn);
    setDeletePopupPosition({
      top: rect.top - 120,
      left: rect.right - 170
    });
    setShowDeletePopup(true);
  };

  // Удаление для себя
  const handleDeleteForMe = async () => {
    if (!deleteMessageId) return;
    dispatch(deleteMessage({ messageId: deleteMessageId, deleteType: 'for_me' }));
  };

  // Удаление для всех
  const handleDeleteForEveryone = async () => {
    if (!deleteMessageId) return;
    dispatch(deleteMessage({ messageId: deleteMessageId, deleteType: 'for_everyone' }));
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
            <span className={styles.emptyIcon}>
              <Icon name="messages" size="large" />
            </span>
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
          <a 
            href={`/user/${conversation.otherUser.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.headerAvatar}
            onClick={(e) => e.stopPropagation()}
          >
            {conversation.otherUser.avatarUrl ? (
              <>
                <img 
                  src={
                    conversation.otherUser.avatarUrl.startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || ''}${conversation.otherUser.avatarUrl}`
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
          </a>
          <h2 className={`${styles.headerName} ${resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).isNickname ? 'displayNameNickname' : ''}`} title={resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).tooltip}>{resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).text}</h2>
        </div>
        <div className={styles.loading}>Загрузка сообщений...</div>
      </div>
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      {alertDialog}
      <div className={styles.container}>
      {/* Шапка с информацией о собеседнике */}
      <div className={styles.header}>
        <a 
          href={`/user/${conversation.otherUser.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.headerAvatar}
        >
          {conversation.otherUser.avatarUrl ? (
            <img 
              src={
                conversation.otherUser.avatarUrl.startsWith('/uploads/')
                  ? `${import.meta.env.VITE_API_URL || ''}${conversation.otherUser.avatarUrl}`
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
        </a>
        <h2 className={`${styles.headerName} ${resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).isNickname ? 'displayNameNickname' : ''}`} title={resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).tooltip}>{resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).text}</h2>
        <div className={styles.headerMenuContainer} ref={menuRef}>
          <button 
            className={styles.headerMenuBtn}
            onClick={() => setShowMenu(!showMenu)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          {showMenu && (
            <div className={styles.headerDropdown}>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowMenu(false);
                  navigate(`/user/${conversation.otherUser.id}`);
                }}
              >
                <Icon name="friends" size="small" /> Профиль
              </button>
              <button 
                className={styles.dropdownItem}
                onClick={handleBlockUser}
              >
                <Icon name="close" size="small" /> Заблокировать
              </button>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowMenu(false);
                  setShowReportModal(true);
                }}
              >
                <Icon name="bug" size="small" /> Пожаловаться
              </button>
            </div>
          )}
        </div>
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
                                  ? `${import.meta.env.VITE_API_URL || ''}${user.avatarUrl}`
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
                        <a 
                          href={`/user/${conversation.otherUser.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.messageAvatar}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {conversation.otherUser.avatarUrl ? (
                            <>
                              <img 
                                src={
                                  conversation.otherUser.avatarUrl.startsWith('/uploads/')
                                    ? `${import.meta.env.VITE_API_URL || ''}${conversation.otherUser.avatarUrl}`
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
                          )}
                        </a>
                      )}
                    </div>
                    
                    <div className={styles.messageBubble}>
                      {message.content && (
                        <p className={styles.messageText}>{message.content}</p>
                      )}
                      
                      {/* Геометка */}
                      {(() => {
                        const loc = parseLocation(message.location);
                        if (!loc) return null;
                        return (
                          <div className={styles.locationCard}>
                            <iframe
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng-0.01},${loc.lat-0.01},${loc.lng+0.01},${loc.lat+0.01}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                              className={styles.locationMap}
                              loading="lazy"
                              title="Карта"
                            />
                            <a 
                              href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=15/${loc.lat}/${loc.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.locationLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Открыть на карте →
                            </a>
                          </div>
                        );
                      })()}

                      {/* Предложенный фильм/сериал */}
                      {(() => {
                        const sm = parseSuggestedMedia(message.suggestedMedia);
                        if (!sm) return null;
                        return (
                          <a 
                            href={`/media/${sm.mediaType}/${sm.tmdbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.suggestedMediaCard}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sm.posterPath ? (
                              <img 
                                src={`https://image.tmdb.org/t/p/w92${sm.posterPath}`}
                                alt={sm.title}
                                className={styles.suggestedMediaPoster}
                              />
                            ) : (
                              <div className={styles.suggestedMediaPlaceholder}>🎬</div>
                            )}
                            <div className={styles.suggestedMediaInfo}>
                              <span className={styles.suggestedMediaTitle}>{sm.title}</span>
                              <div className={styles.suggestedMediaMeta}>
                                <span className={styles.suggestedMediaType}>
                                  {sm.mediaType === 'movie' ? 'Фильм' : 'Сериал'}
                                </span>
                                {sm.voteAverage > 0 && (
                                  <span className={styles.suggestedMediaRating}>★ {sm.voteAverage.toFixed(1)}</span>
                                )}
                              </div>
                            </div>
                          </a>
                        );
                      })()}
                      
                      {/* Вложения */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className={styles.attachments}>
                          {message.attachments.map((attachment, attIndex) => (
                            <div key={attIndex} className={styles.attachment}>
                              {attachment.mimetype.startsWith('image/') ? (
                                <img
                                  src={`${import.meta.env.VITE_API_URL || ''}${attachment.path}`}
                                  alt={attachment.originalName}
                                  className={styles.attachmentImage}
                                  onClick={() => handleImageClick(message.attachments, attIndex)}
                                />
                              ) : attachment.mimetype.startsWith('audio/') ? (
                                <AudioPlayer 
                                  src={`${import.meta.env.VITE_API_URL || ''}${attachment.path}`}
                                  type={attachment.mimetype}
                                />
                              ) : (
                                <a
                                  href={`${import.meta.env.VITE_API_URL || ''}${attachment.path}`}
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
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => handleDeleteClick(e, message.id, isOwnMessage)}
                          title="Удалить сообщение"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
            {/* Кнопка скролла вниз — внутри messagesList */}
            {showScrollButton && (
            <button 
              className={styles.scrollDownButton}
              onClick={() => scrollToBottom(true)}
              title="К новым сообщениям"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
              </button>
            )}
          </div>
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
              ref={attachFileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="*/*"
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={attachImageInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
            />
            
            {(isRecording || audioBlob) ? (
              <RecordingOverlay
                recordingTime={recordingTime}
                analyserData={analyserData}
                audioBuffer={audioBuffer}
                isRecording={isRecording}
                onSend={handleSendAudio}
                onCancel={() => { cancelRecording(); resetRecording(); }}
                onStop={stopRecording}
              />
            ) : (
              <>
                <div className={styles.attachContainer}>
                  <button
                    type="button"
                    className={styles.attachButton}
                    onClick={() => setShowAttachDropdown(!showAttachDropdown)}
                    title="Прикрепить"
                  >
                    <Icon name="paperclip" size="medium" />
                  </button>
                  {showAttachDropdown && (
                    <AttachmentDropdown
                      onSelect={handleAttachmentSelect}
                      onClose={() => setShowAttachDropdown(false)}
                    />
                  )}
                </div>
                <div className={styles.inputFieldWrapper}>
                  <textarea
                    className={styles.input}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Напишите сообщение..."
                    rows={1}
                    disabled={sendingMessage}
                  />
                  {messageText.trim() && (
                    <button
                      type="button"
                      className={styles.clearInputButton}
                      onClick={() => setMessageText('')}
                      title="Очистить"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {hasContent ? (
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={(!messageText.trim() && selectedFiles.length === 0) || sendingMessage}
                  >
                    {sendingMessage ? '...' : '➤'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.sendButton} ${styles.recordButton}`}
                    onMouseDown={handleRecordMouseDown}
                    onMouseUp={handleRecordMouseUp}
                    onMouseLeave={handleRecordMouseUp}
                    onTouchStart={handleRecordTouchStart}
                    onTouchEnd={handleRecordTouchEnd}
                    title="Зажмите для записи"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  </button>
                )}
              </>
            )}
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
              src={`${import.meta.env.VITE_API_URL || ''}${modalImages[currentImageIndex]?.path}`}
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
      <DeleteMessagePopup
        isOpen={showDeletePopup}
        onClose={() => { setShowDeletePopup(false); setDeleteMessageId(null); }}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        isOwnMessage={deleteMessageIsOwn}
        position={deletePopupPosition}
      />
      {showReportModal && (
        <ReportModal
          reportedUserId={conversation.otherUser.id}
          reportedUserName={conversation.otherUser.displayName}
          onClose={() => setShowReportModal(false)}
        />
      )}
      {showSuggestModal && (
        <SuggestMediaModal
          mediaType={suggestMediaType}
          conversationId={conversation.id}
          onSend={handleSendSuggestedMedia}
          onClose={() => setShowSuggestModal(false)}
        />
      )}
      {showLocationModal && (
        <LocationModal
          onSend={handleSendLocation}
          onClose={() => setShowLocationModal(false)}
        />
      )}
    </>
  );
};

export default MessageThread;
