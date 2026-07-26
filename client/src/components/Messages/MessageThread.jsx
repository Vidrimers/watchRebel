import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchMessages, fetchConversations, sendMessage, deleteMessage } from '../../store/slices/messagesSlice';
import { addMessageHandler, removeMessageHandler } from '../../services/websocket';
import { hasSessionKey, getOrCreateSessionKey, fetchPublicKey, getSessionKey, encryptMessage, decryptMessage, isEncryptedMessage, needsRotation, rotateSessionKey, getRotationCounter, extractRotationCounter, getSessionKeyByRotation } from '../../services/e2ee';
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
import GroupMembersModal from './GroupMembersModal';
import GroupSettingsModal from './GroupSettingsModal';
import AnnouncementModal from './AnnouncementModal';
import MentionAutocomplete from '../Common/MentionAutocomplete';
import ReactionPicker from '../Wall/ReactionPicker';
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

// РџР°СЂСЃРёРЅРі СѓРїРѕРјРёРЅР°РЅРёР№ РІ С‚РµРєСЃС‚Рµ СЃРѕРѕР±С‰РµРЅРёСЏ
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;
const renderMessageContent = (text) => {
  if (!text) return null;
  const parts = [];
  let lastIndex = 0;
  let match;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      React.createElement('a', {
        key: `mention-${match.index}`,
        href: `/user/${match[2]}`,
        className: styles.mentionLink
      }, `@${match[1]}`)
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
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
 * РћРєРЅРѕ РїРµСЂРµРїРёСЃРєРё
 * РћС‚РѕР±СЂР°Р¶Р°РµС‚ СЃРѕРѕР±С‰РµРЅРёСЏ РІ РІС‹Р±СЂР°РЅРЅРѕРј РґРёР°Р»РѕРіРµ Рё РїРѕР·РІРѕР»СЏРµС‚ РѕС‚РїСЂР°РІР»СЏС‚СЊ РЅРѕРІС‹Рµ
 */
const MessageThread = ({ conversation, onClose }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { messages, group, loading, loadingMore, hasMoreMessages, sendingMessage } = useAppSelector((state) => state.messages);
  const { user } = useAppSelector((state) => state.auth);

  const [conversationOverrides, setConversationOverrides] = useState({});

  // РњРµСЂР¶РёРј РїСЂРѕРї conversation СЃ Р»РѕРєР°Р»СЊРЅС‹РјРё РѕРІРµСЂСЂР°Р№РґР°РјРё (РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РёРјРµРЅРё/Р°РІР°С‚Р°СЂРєРё Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё)
  const effectiveConversation = { ...conversation, ...conversationOverrides };

  // РҐРµР»РїРµСЂС‹ РґР»СЏ РіСЂСѓРїРїРѕРІС‹С… С‡Р°С‚РѕРІ (РёСЃРїРѕР»СЊР·СѓРµРј effectiveConversation РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёР№ Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё)
  const isGroup = effectiveConversation?.isGroup;
  const getReceiverId = () => isGroup ? effectiveConversation.id : effectiveConversation.otherUser?.id;
  const getDisplayName = () => isGroup ? effectiveConversation.groupName : effectiveConversation.otherUser?.displayName;
  const getAvatarUrl = () => isGroup ? effectiveConversation.groupAvatar : effectiveConversation.otherUser?.avatarUrl;
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
  const [deleteIsAnnouncement, setDeleteIsAnnouncement] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showGroupAvatarModal, setShowGroupAvatarModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const textareaRef = useRef(null);

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

  // Р—Р°РіСЂСѓР¶Р°РµРј СЃРѕРѕР±С‰РµРЅРёСЏ РїСЂРё РІС‹Р±РѕСЂРµ РґРёР°Р»РѕРіР° (СЃ СѓС‡С‘С‚РѕРј E2EE)
  useEffect(() => {
    if (!conversation || !conversation.id) return;

    const loadMessages = async () => {
      // Р”Р»СЏ СЃРµРєСЂРµС‚РЅС‹С… С‡Р°С‚РѕРІ: СЃРЅР°С‡Р°Р»Р° РІС‹С‡РёСЃР»СЏРµРј session key, РїРѕС‚РѕРј Р·Р°РіСЂСѓР¶Р°РµРј СЃРѕРѕР±С‰РµРЅРёСЏ
      if (conversation.isSecret) {
        if (!hasSessionKey(conversation.id)) {
          try {
            const otherUserId = conversation.otherUser?.id;
            if (!otherUserId) return;
            const theirKey = await fetchPublicKey(otherUserId);
            if (theirKey) {
              getOrCreateSessionKey(conversation.id, theirKey.publicKey);
            }
          } catch (err) {
            console.error('РћС€РёР±РєР° РІС‹С‡РёСЃР»РµРЅРёСЏ СЃРµСЃСЃРёРѕРЅРЅРѕРіРѕ РєР»СЋС‡Р°:', err);
          }
        }
        dispatch(fetchMessages({ conversationId: conversation.id, limit: 20, offset: 0, isSecret: true }));
      } else {
        dispatch(fetchMessages({ conversationId: conversation.id, limit: 20, offset: 0 }));
      }
    };

    loadMessages();
  }, [conversation?.id, conversation?.isSecret, conversation?.otherUser?.id, dispatch]);

  // РЎРєСЂРѕР»Р» РІРЅРёР· РїСЂРё Р·Р°РіСЂСѓР·РєРµ СЃРѕРѕР±С‰РµРЅРёР№ РІ РЅРѕРІРѕРј РґРёР°Р»РѕРіРµ
  const prevConversationRef = useRef(null);
  const prevMessagesLenRef = useRef(0);
  useEffect(() => {
    // РџСЂРё СЃРјРµРЅРµ РґРёР°Р»РѕРіР° вЂ” СЃР±СЂР°СЃС‹РІР°РµРј СЃС‡С‘С‚С‡РёРє
    if (conversation?.id !== prevConversationRef.current) {
      prevConversationRef.current = conversation?.id;
      prevMessagesLenRef.current = 0;
      return;
    }
    
    // РЎРєСЂРѕР»Р»РёРј РєРѕРіРґР° СЃРѕРѕР±С‰РµРЅРёСЏ РІРїРµСЂРІС‹Рµ Р·Р°РіСЂСѓР·РёР»РёСЃСЊ (Р±С‹Р»Рѕ 0, СЃС‚Р°Р»Рѕ >0)
    if (messages.length > 0 && prevMessagesLenRef.current === 0) {
      prevMessagesLenRef.current = messages.length;
      // РњРіРЅРѕРІРµРЅРЅС‹Р№ СЃРєСЂРѕР»Р» вЂ” Р±РµР· Р°РЅРёРјР°С†РёРё
      scrollToBottom(false);
    }
    
    prevMessagesLenRef.current = messages.length;
  }, [conversation?.id, messages.length]);

  // РџРѕРґРєР»СЋС‡Р°РµРј РѕР±СЂР°Р±РѕС‚С‡РёРє WebSocket СЃРѕРѕР±С‰РµРЅРёР№
  useEffect(() => {
    // РћР±СЂР°Р±РѕС‚С‡РёРє РЅРѕРІС‹С… СЃРѕРѕР±С‰РµРЅРёР№ С‡РµСЂРµР· WebSocket
    const handleWebSocketMessage = async (data) => {
      if (data.type === 'new_message' && data.message) {
        const message = { ...data.message };

        // Р Р°СЃС€РёС„СЂРѕРІРєР° РґР»СЏ СЃРµРєСЂРµС‚РЅС‹С… С‡Р°С‚РѕРІ
        if (conversation?.isSecret && isEncryptedMessage(message.content)) {
          try {
            // РћРїСЂРµРґРµР»СЏРµРј РЅСѓР¶РЅС‹Р№ РєР»СЋС‡ РїРѕ СЃС‡С‘С‚С‡РёРєСѓ СЂРѕС‚Р°С†РёРё
            const rotationCounter = extractRotationCounter(message.content);
            const sessionKey = getSessionKeyByRotation(conversation.id, rotationCounter) || getSessionKey(conversation.id);
            if (sessionKey) {
              message.content = await decryptMessage(message.content, sessionKey);
            }
          } catch (err) {
            console.error('РћС€РёР±РєР° СЂР°СЃС€РёС„СЂРѕРІРєРё WebSocket СЃРѕРѕР±С‰РµРЅРёСЏ:', err);
          }
        }

        dispatch({
          type: 'messages/addNewMessage',
          payload: message
        });
      } else if (data.type === 'announcement_deleted' && data.messageId) {
        dispatch({
          type: 'messages/removeMessage',
          payload: data.messageId
        });
      }
    };

    addMessageHandler(handleWebSocketMessage);

    return () => {
      removeMessageHandler(handleWebSocketMessage);
    };
  }, [dispatch, conversation?.id, conversation?.isSecret]);

  // РџРѕРєР°Р·С‹РІР°РµРј РєРЅРѕРїРєСѓ СЃРєСЂРѕР»Р»Р° РІРЅРёР· РїСЂРё РїРѕСЏРІР»РµРЅРёРё РЅРѕРІС‹С… СЃРѕРѕР±С‰РµРЅРёР№
  useEffect(() => {
    if (messages.length === 0) return;
    
    const currentLastMessage = messages[messages.length - 1];
    const currentLastMessageId = currentLastMessage?.id;
    
    // Р•СЃР»Рё ID РїРѕСЃР»РµРґРЅРµРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ РёР·РјРµРЅРёР»СЃСЏ - Р·РЅР°С‡РёС‚ РїСЂРёС€Р»Рѕ РЅРѕРІРѕРµ
    if (lastMessageId && currentLastMessageId !== lastMessageId) {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        
        // РџСЂРѕРІРµСЂСЏРµРј РїРѕСЃР»РµРґРЅРµРµ СЃРѕРѕР±С‰РµРЅРёРµ - РѕС‚ РјРµРЅСЏ РёР»Рё РЅРµС‚
        const isMyMessage = currentLastMessage?.senderId === user?.id;
        
        if (isMyMessage) {
          // Р•СЃР»Рё СЏ РѕС‚РїСЂР°РІРёР» - РІСЃРµРіРґР° СЃРєСЂРѕР»Р»РёРј РјРіРЅРѕРІРµРЅРЅРѕ
          scrollToBottom(false);
        } else if (isNearBottom) {
          // Р•СЃР»Рё РїСЂРёС€Р»Рѕ РѕС‚ РґСЂСѓРіРѕРіРѕ Рё СЏ РІРЅРёР·Сѓ - СЃРєСЂРѕР»Р»РёРј РјРіРЅРѕРІРµРЅРЅРѕ
          scrollToBottom(false);
        } else {
          // Р•СЃР»Рё РїСЂРёС€Р»Рѕ РѕС‚ РґСЂСѓРіРѕРіРѕ Рё СЏ РќР• РІРЅРёР·Сѓ - РїРѕРєР°Р·С‹РІР°РµРј РєРЅРѕРїРєСѓ
          setShowScrollButton(true);
        }
      }
    }
    
    // РћР±РЅРѕРІР»СЏРµРј lastMessageId С‚РѕР»СЊРєРѕ РµСЃР»Рё РѕРЅ РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ РёР·РјРµРЅРёР»СЃСЏ
    if (currentLastMessageId !== lastMessageId) {
      setLastMessageId(currentLastMessageId);
    }
  }, [messages.length, user?.id]); // РЈР±СЂР°Р» messages Рё lastMessageId РёР· Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№

  // Р—Р°РєСЂС‹С‚РёРµ РјРµРЅСЋ РїСЂРё РєР»РёРєРµ РІРЅРµ
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

  // Р—Р°РєСЂС‹С‚РёРµ РґРёР°Р»РѕРіР° РїРѕ Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && conversation) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [conversation, onClose]);

  // РћР±СЂР°Р±РѕС‚С‡РёРє СЃРєСЂРѕР»Р»Р° РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ РєРѕРіРґР° Р·Р°РіСЂСѓР¶Р°С‚СЊ СЃС‚Р°СЂС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ
  const handleScroll = (e) => {
    const container = e.target;
    
    // Р—Р°РєСЂС‹РІР°РµРј popup СѓРґР°Р»РµРЅРёСЏ РїСЂРё СЃРєСЂРѕР»Р»Рµ
    if (showDeletePopup) {
      setShowDeletePopup(false);
      setDeleteMessageId(null);
    }
    
    // Р•СЃР»Рё РїСЂРѕСЃРєСЂРѕР»Р»РёР»Рё РІ СЃР°РјС‹Р№ РІРµСЂС… Рё РµСЃС‚СЊ РµС‰Рµ СЃРѕРѕР±С‰РµРЅРёСЏ
    if (container.scrollTop === 0 && hasMoreMessages && !loadingMore) {
      loadOlderMessages();
    }

    // РџРѕРєР°Р·С‹РІР°РµРј/СЃРєСЂС‹РІР°РµРј РєРЅРѕРїРєСѓ СЃРєСЂРѕР»Р»Р° РІРЅРёР·
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  };

  // Р—Р°РіСЂСѓР·РєР° СЃС‚Р°СЂС‹С… СЃРѕРѕР±С‰РµРЅРёР№
  const loadOlderMessages = async () => {
    if (!conversation || !conversation.id || loadingMore) return;
    
    const container = messagesContainerRef.current;
    const previousScrollHeight = container.scrollHeight;
    
    await dispatch(fetchMessages({
      conversationId: conversation.id,
      limit: 20,
      offset: messages.length,
      isSecret: conversation.isSecret || false
    }));
    
    // РЎРѕС…СЂР°РЅСЏРµРј РїРѕР·РёС†РёСЋ СЃРєСЂРѕР»Р»Р° РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё
    setTimeout(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - previousScrollHeight;
    }, 0);
  };

  // РћС‚РїСЂР°РІРєР° РіРµРѕРјРµС‚РєРё
  const handleSendLocation = async (data) => {
    try {
      await dispatch(sendMessage({
        receiverId: getReceiverId(),
        content: `рџ“Ќ ${data.latitude}, ${data.longitude}`,
        files: [],
        location: { lat: data.latitude, lng: data.longitude }
      }));
    } catch (error) {
      console.error('РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё:', error);
    }
  };

  // РћС‚РїСЂР°РІРєР° РїСЂРµРґР»РѕР¶РµРЅРЅРѕРіРѕ РјРµРґРёР°
  const handleSendSuggestedMedia = async (data) => {
    try {
      await dispatch(sendMessage({
        receiverId: getReceiverId(),
        content: `рџЋ¬ ${data.title}`,
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
      console.error('РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё:', error);
    }
  };

  // Р‘Р»РѕРєРёСЂРѕРІРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
  // РћР±СЂР°Р±РѕС‚РєР° РІС‹Р±РѕСЂР° С‚РёРїР° РІР»РѕР¶РµРЅРёСЏ
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
      case 'announcement':
        setShowAnnouncementModal(true);
        break;
    }
  };

  const handleBlockUser = async () => {
    setShowMenu(false);
    const confirmed = await showConfirm({
      title: 'Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ?',
      message: `Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ ${conversation.otherUser.displayName}? Р’С‹ РЅРµ Р±СѓРґРµС‚Рµ РІРёРґРµС‚СЊ РµРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ.`,
      confirmText: 'Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ',
      cancelText: 'РћС‚РјРµРЅР°',
      confirmButtonStyle: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.post(`/users/${conversation.otherUser.id}/block`);
      await showAlert({
        title: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ',
        message: `${conversation.otherUser.displayName} Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ`,
        type: 'success'
      });
      navigate('/messages');
    } catch (error) {
      await showAlert({
        title: 'РћС€РёР±РєР°',
        message: error.response?.data?.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ',
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

  // РћР±СЂР°Р±РѕС‚С‡РёРє РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ
  const handleSendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('рџ“¤ РћС‚РїСЂР°РІРєР° СЃРѕРѕР±С‰РµРЅРёСЏ:', { 
      hasText: !!messageText.trim(), 
      filesCount: selectedFiles.length,
      sendingMessage 
    });
    
    if ((!messageText.trim() && selectedFiles.length === 0) || sendingMessage) {
      console.log('вљ пёЏ РћС‚РїСЂР°РІРєР° РѕС‚РјРµРЅРµРЅР°: РЅРµС‚ РєРѕРЅС‚РµРЅС‚Р° РёР»Рё СѓР¶Рµ РѕС‚РїСЂР°РІР»СЏРµС‚СЃСЏ');
      return;
    }

    let content = messageText.trim();
    const files = selectedFiles;
    let originalContent = null;

    setMessageText('');
    setSelectedFiles([]);

    // РЁРёС„СЂРѕРІР°РЅРёРµ РґР»СЏ СЃРµРєСЂРµС‚РЅС‹С… С‡Р°С‚РѕРІ
    if (conversation.isSecret && content) {
      try {
        // РџСЂРѕРІРµСЂСЏРµРј РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚СЊ СЂРѕС‚Р°С†РёРё РєР»СЋС‡Р°
        let sessionKey = getSessionKey(conversation.id);
        if (!sessionKey) {
          console.error('РќРµС‚ СЃРµСЃСЃРёРѕРЅРЅРѕРіРѕ РєР»СЋС‡Р° РґР»СЏ С€РёС„СЂРѕРІР°РЅРёСЏ');
          setMessageText(content);
          setSelectedFiles(files);
          return;
        }

        // Р РѕС‚Р°С†РёСЏ РµСЃР»Рё РґРѕСЃС‚РёРіРЅСѓС‚ РїРѕСЂРѕРі СЃРѕРѕР±С‰РµРЅРёР№
        const messageCount = messages.length;
        if (needsRotation(conversation.id, messageCount)) {
          const otherUserId = conversation.otherUser?.id;
          const theirKey = await fetchPublicKey(otherUserId);
          if (theirKey) {
            sessionKey = rotateSessionKey(conversation.id, theirKey.publicKey);
          }
        }

        originalContent = content;
        const rotationCounter = getRotationCounter(conversation.id);
        content = await encryptMessage(content, sessionKey, rotationCounter);
      } catch (err) {
        console.error('РћС€РёР±РєР° С€РёС„СЂРѕРІР°РЅРёСЏ:', err);
        setMessageText(content);
        setSelectedFiles(files);
        return;
      }
    }

    try {
      const result = await dispatch(sendMessage({
        receiverId: getReceiverId(),
        content,
        files,
        originalContent
      }));

      console.log('вњ… РЎРѕРѕР±С‰РµРЅРёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ:', result);

      // Р•СЃР»Рё СЌС‚Рѕ РЅРѕРІС‹Р№ РґРёР°Р»РѕРі (id === null), РѕР±РЅРѕРІР»СЏРµРј СЃРїРёСЃРѕРє РґРёР°Р»РѕРіРѕРІ
      if (conversation.id === null && result.meta.requestStatus === 'fulfilled') {
        // Р”РёР°Р»РѕРі Р±СѓРґРµС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РґРѕР±Р°РІР»РµРЅ РІ СЃРїРёСЃРѕРє С‡РµСЂРµР· fetchConversations
        // РєРѕС‚РѕСЂС‹Р№ РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ ConversationList РїСЂРё РјРѕРЅС‚РёСЂРѕРІР°РЅРёРё
      }
    } catch (error) {
      console.error('вќЊ РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ:', error);
      // Р’РѕР·РІСЂР°С‰Р°РµРј С„Р°Р№Р»С‹ РѕР±СЂР°С‚РЅРѕ РїСЂРё РѕС€РёР±РєРµ
      setSelectedFiles(files);
      setMessageText(content);
    }
  };

  // РћР±СЂР°Р±РѕС‚С‡РёРє РІС‹Р±РѕСЂР° С„Р°Р№Р»РѕРІ
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        alert(`Р¤Р°Р№Р» ${file.name} СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№. РњР°РєСЃРёРјСѓРј 50РњР‘`);
        return false;
      }
      return true;
    });
    
    if (selectedFiles.length + validFiles.length > 10) {
      alert('РњР°РєСЃРёРјСѓРј 10 С„Р°Р№Р»РѕРІ Р·Р° СЂР°Р·');
      return;
    }
    
    setSelectedFiles([...selectedFiles, ...validFiles]);
  };

  // РЈРґР°Р»РµРЅРёРµ С„Р°Р№Р»Р° РёР· СЃРїРёСЃРєР°
  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  // РћС‚РєСЂС‹С‚РёРµ РіР°Р»РµСЂРµРё РёР·РѕР±СЂР°Р¶РµРЅРёР№
  const handleImageClick = (attachments, index) => {
    const images = attachments.filter(att => att.mimetype.startsWith('image/'));
    setModalImages(images);
    setCurrentImageIndex(index);
    setShowImageModal(true);
    setImageDimensions({ natural: { width: 0, height: 0 }, displayed: { width: 0, height: 0 } });
  };

  // РћР±РЅРѕРІР»РµРЅРёРµ СЂР°Р·РјРµСЂРѕРІ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ
  const handleImageLoad = (e) => {
    const img = e.target;
    if (img && img.naturalWidth && img.naturalHeight) {
      setImageDimensions({
        natural: { width: img.naturalWidth, height: img.naturalHeight },
        displayed: { width: Math.round(img.width), height: Math.round(img.height) }
      });
    }
  };

  // РћР±СЂР°Р±РѕС‚С‡РёРє РЅР°Р¶Р°С‚РёСЏ Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // РћС‚РїСЂР°РІРєР° Р°СѓРґРёРѕСЃРѕРѕР±С‰РµРЅРёСЏ
  const handleSendAudio = async () => {
    if (!audioBlob || sendingMessage) return;
    
    const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: audioBlob.type });
    
    try {
      await dispatch(sendMessage({
        receiverId: getReceiverId(),
        content: '',
        files: [file]
      }));
      resetRecording();
    } catch (error) {
      console.error('РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё Р°СѓРґРёРѕ:', error);
    }
  };

  // РћР±СЂР°Р±РѕС‚С‡РёРєРё РєРЅРѕРїРєРё Р·Р°РїРёСЃРё (РґР»РёРЅРЅРѕРµ РЅР°Р¶Р°С‚РёРµ = Р·Р°РїРёСЃСЊ)
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
      // РљРѕСЂРѕС‚РєРѕРµ РЅР°Р¶Р°С‚РёРµ вЂ” РЅРёС‡РµРіРѕ (РѕСЃС‚Р°С‘РјСЃСЏ РІ С‚РµРєСЃС‚РѕРІРѕРј СЂРµР¶РёРјРµ)
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

  // РћРїСЂРµРґРµР»СЏРµРј, РЅСѓР¶РЅРѕ Р»Рё РїРѕРєР°Р·С‹РІР°С‚СЊ РєРЅРѕРїРєСѓ Р·Р°РїРёСЃРё
  const hasContent = messageText.trim() || selectedFiles.length > 0;

  // Р’СЃС‚Р°РІРєР° СЌРјРѕРґР·Рё РІ textarea
  const handleEmojiSelect = (emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // РћР±СЂР°Р±РѕС‚С‡РёРє СѓРґР°Р»РµРЅРёСЏ СЃРѕРѕР±С‰РµРЅРёСЏ вЂ” РїРѕРєР°Р· popup РЅР°Рґ РєСЂРµСЃС‚РёРєРѕРј
  const handleDeleteClick = (e, messageId, isOwn, isAnnouncement = false) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    
    setDeleteMessageId(messageId);
    setDeleteMessageIsOwn(isOwn);
    setDeleteIsAnnouncement(isAnnouncement);
    setDeletePopupPosition({
      top: rect.top - 120,
      left: rect.right - 170
    });
    setShowDeletePopup(true);
  };

  // РЈРґР°Р»РµРЅРёРµ РґР»СЏ СЃРµР±СЏ
  const handleDeleteForMe = async () => {
    if (!deleteMessageId) return;
    dispatch(deleteMessage({ messageId: deleteMessageId, deleteType: 'for_me' }));
  };

  // РЈРґР°Р»РµРЅРёРµ РґР»СЏ РІСЃРµС…
  const handleDeleteForEveryone = async () => {
    if (!deleteMessageId) return;
    if (deleteIsAnnouncement) {
      try {
        await api.delete(`/messages/announcement/${deleteMessageId}`);
        dispatch({ type: 'messages/removeMessage', payload: deleteMessageId });
      } catch (err) {
        console.error('РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ РѕР±СЉСЏРІР»РµРЅРёСЏ:', err);
      }
    } else {
      dispatch(deleteMessage({ messageId: deleteMessageId, deleteType: 'for_everyone' }));
    }
  };

  // Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РІСЂРµРјРµРЅРё
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РґР°С‚С‹ РґР»СЏ СЂР°Р·РґРµР»РёС‚РµР»СЏ
  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'РЎРµРіРѕРґРЅСЏ';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Р’С‡РµСЂР°';
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // РџСЂРѕРІРµСЂРєР°, РЅСѓР¶РµРЅ Р»Рё СЂР°Р·РґРµР»РёС‚РµР»СЊ РґР°С‚С‹
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
            <p>Р’С‹Р±РµСЂРёС‚Рµ РґРёР°Р»РѕРі РґР»СЏ РЅР°С‡Р°Р»Р° РїРµСЂРµРїРёСЃРєРё</p>
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
          {isGroup ? (
            <div
              className={styles.headerAvatar}
              onClick={() => getAvatarUrl() && setShowGroupAvatarModal(true)}
              style={{ cursor: getAvatarUrl() ? 'pointer' : 'default' }}
            >
              {getAvatarUrl() ? (
                <img
                  src={
                    getAvatarUrl().startsWith('/uploads/')
                      ? `${import.meta.env.VITE_API_URL || ''}${getAvatarUrl()}`
                      : getAvatarUrl()
                  }
                  alt={getDisplayName()}
                  className={styles.headerAvatarImage}
                />
              ) : (
                <div className={styles.headerAvatarPlaceholder}>рџ‘Ґ</div>
              )}
            </div>
          ) : (
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
          )}
        {isGroup ? (
          <h2
            className={`${styles.headerName} ${styles.headerNameClickable}`}
            title="Р“СЂСѓРїРїРѕРІРѕР№ С‡Р°С‚"
            onClick={() => setShowMembersModal(true)}
          >
            рџ‘Ґ {getDisplayName()}
          </h2>
        ) : (
          <h2 className={styles.headerName}>
            {conversation.isSecret ? '?? ' : ''}
            {resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).text}
          </h2>
        )}
        {conversation.isSecret && (
          <span className={styles.secretChatBadge}>Секретный чат · E2EE</span>
        )}
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
      {/* РЁР°РїРєР° СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ СЃРѕР±РµСЃРµРґРЅРёРєРµ/РіСЂСѓРїРїРµ */}
      <div className={styles.header}>
        {isGroup ? (
          <div
            className={styles.headerAvatar}
            onClick={() => getAvatarUrl() && setShowGroupAvatarModal(true)}
            style={{ cursor: getAvatarUrl() ? 'pointer' : 'default' }}
          >
            {getAvatarUrl() ? (
              <img
                src={
                  getAvatarUrl().startsWith('/uploads/')
                    ? `${import.meta.env.VITE_API_URL || ''}${getAvatarUrl()}`
                    : getAvatarUrl()
                }
                alt={getDisplayName()}
                className={styles.headerAvatarImage}
              />
            ) : (
              <div className={styles.headerAvatarPlaceholder}>рџ‘Ґ</div>
            )}
          </div>
        ) : (
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
        )}
        {isGroup ? (
          <h2
            className={`${styles.headerName} ${styles.headerNameClickable}`}
            title="Р“СЂСѓРїРїРѕРІРѕР№ С‡Р°С‚"
            onClick={() => setShowMembersModal(true)}
          >
            рџ‘Ґ {getDisplayName()}
          </h2>
        ) : (
          <h2 className={styles.headerName}>
            {conversation.isSecret ? 'рџ”’ ' : ''}
            {resolveDisplayNameWithTooltip(conversation.otherUser.id, conversation.otherUser.displayName).text}
          </h2>
        )}
        {conversation.isSecret && (
          <span className={styles.secretChatBadge}>РЎРµРєСЂРµС‚РЅС‹Р№ С‡Р°С‚ В· E2EE</span>
        )}
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
              {!isGroup && (
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    setShowMenu(false);
                    navigate(`/user/${conversation.otherUser.id}`);
                  }}
                >
                  <Icon name="friends" size="small" /> РџСЂРѕС„РёР»СЊ
                </button>
              )}
              {isGroup && (
                <>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setShowMenu(false);
                      setShowMembersModal(true);
                    }}
                  >
                    <Icon name="friends" size="small" /> РЈС‡Р°СЃС‚РЅРёРєРё
                  </button>
                  {effectiveConversation.createdBy === user.id && (
                    <button
                      className={styles.dropdownItem}
                      onClick={() => {
                        setShowMenu(false);
                        setShowGroupSettings(true);
                      }}
                    >
                      <Icon name="settings" size="small" /> РќР°СЃС‚СЂРѕР№РєРё
                    </button>
                  )}
                </>
              )}
              {!isGroup && (
                <>
                  <button
                    className={styles.dropdownItem}
                    onClick={handleBlockUser}
                  >
                    <Icon name="close" size="small" /> Р—Р°Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportModal(true);
                    }}
                  >
                    <Icon name="bug" size="small" /> РџРѕР¶Р°Р»РѕРІР°С‚СЊСЃСЏ
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* РЎРїРёСЃРѕРє СЃРѕРѕР±С‰РµРЅРёР№ */}
      <div 
        className={styles.messagesContainer} 
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className={styles.emptyMessages}>
            <p>{isGroup ? `РќР°С‡РЅРёС‚Рµ РѕР±С‰РµРЅРёРµ РІ "${conversation.groupName}"` : `РќР°С‡РЅРёС‚Рµ РїРµСЂРµРїРёСЃРєСѓ СЃ ${conversation.otherUser?.displayName}`}</p>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {loadingMore && (
              <div className={styles.loadingMore}>Р—Р°РіСЂСѓР·РєР° СЃС‚Р°СЂС‹С… СЃРѕРѕР±С‰РµРЅРёР№...</div>
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

                  {/* РћР±СЉСЏРІР»РµРЅРёРµ вЂ” РїРѕ С†РµРЅС‚СЂСѓ */}
                  {message.isAnnouncement ? (
                    <div className={styles.announcementMessage}>
                      <div className={styles.announcementHeader}>
                        <Icon name="announcement" size="small" />
                        <span>РћР±СЉСЏРІР»РµРЅРёРµ</span>
                        {/* РљРЅРѕРїРєР° СѓРґР°Р»РµРЅРёСЏ вЂ” С‚РѕР»СЊРєРѕ Р°РІС‚РѕСЂ РёР»Рё РјРѕРґРµСЂР°С‚РѕСЂ СЃ delete_announcements */}
                        {(
                          message.senderId === user.id ||
                          (isGroup && (effectiveConversation.createdBy === user.id || group?.canDeleteAnnouncements))
                        ) && (
                          <button
                            className={styles.announcementDeleteBtn}
                            onClick={(e) => handleDeleteClick(e, message.id, message.senderId === user.id, true)}
                            title="РЈРґР°Р»РёС‚СЊ РѕР±СЉСЏРІР»РµРЅРёРµ"
                          >
                            Г—
                          </button>
                        )}
                      </div>
                      {message.sender?.displayName && (
                        <div className={styles.announcementAuthor}>
                          {message.sender.displayName}
                        </div>
                      )}
                      {message.content && (
                        <div className={styles.announcementText}>
                          {renderMessageContent(message.content)}
                        </div>
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className={styles.announcementImages}>
                          {message.attachments.filter(a => a.mimetype?.startsWith('image/')).map((att, i) => (
                            <img
                              key={i}
                              src={`${import.meta.env.VITE_API_URL || ''}${att.path}`}
                              alt={att.originalName}
                              className={styles.announcementImage}
                              onClick={() => handleImageClick(message.attachments.filter(a => a.mimetype?.startsWith('image/')), i)}
                            />
                          ))}
                        </div>
                      )}
                      <div className={styles.announcementTime}>{formatTime(message.createdAt)}</div>
                    </div>
                  ) : (
                  <>
                  {/* РРјСЏ РѕС‚РїСЂР°РІРёС‚РµР»СЏ РґР»СЏ РіСЂСѓРїРїРѕРІС‹С… С‡Р°С‚РѕРІ вЂ” РЅР°Рґ СЃРѕРѕР±С‰РµРЅРёРµРј */}
                  {isGroup && !isOwnMessage && message.sender?.displayName && (
                    <div className={styles.senderNameRow}>
                      <a
                        href={`/user/${message.senderId}`}
                        className={styles.senderName}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {message.sender.displayName}
                      </a>
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
                        (() => {
                          // Р”Р»СЏ РіСЂСѓРїРїРѕРІС‹С… С‡Р°С‚РѕРІ вЂ” Р°РІР°С‚Р°СЂ СЂРµР°Р»СЊРЅРѕРіРѕ РѕС‚РїСЂР°РІРёС‚РµР»СЏ
                          const senderAvatar = isGroup ? message.sender?.avatarUrl : conversation.otherUser?.avatarUrl;
                          const senderName = isGroup ? message.sender?.displayName : conversation.otherUser?.displayName;
                          const senderId = isGroup ? message.senderId : conversation.otherUser?.id;

                          return isGroup ? (
                            <a
                              href={`/user/${senderId}`}
                              className={styles.messageAvatar}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {senderAvatar ? (
                                <img
                                  src={
                                    senderAvatar.startsWith('/uploads/')
                                      ? `${import.meta.env.VITE_API_URL || ''}${senderAvatar}`
                                      : senderAvatar
                                  }
                                  alt={senderName}
                                  className={styles.messageAvatarImage}
                                />
                              ) : (
                                <div className={styles.messageAvatarPlaceholder}>
                                  {senderName?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                            </a>
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
                          );
                        })()
                      )}
                    </div>
                    
                    <div className={styles.messageBubble}>
                      {message.content && (
                        <p className={styles.messageText}>{renderMessageContent(message.content)}</p>
                      )}
                      
                      {/* Р“РµРѕРјРµС‚РєР° */}
                      {(() => {
                        const loc = parseLocation(message.location);
                        if (!loc) return null;
                        return (
                          <div className={styles.locationCard}>
                            <iframe
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng-0.01},${loc.lat-0.01},${loc.lng+0.01},${loc.lat+0.01}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                              className={styles.locationMap}
                              loading="lazy"
                              title="РљР°СЂС‚Р°"
                            />
                            <a 
                              href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=15/${loc.lat}/${loc.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.locationLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              РћС‚РєСЂС‹С‚СЊ РЅР° РєР°СЂС‚Рµ в†’
                            </a>
                          </div>
                        );
                      })()}

                      {/* РџСЂРµРґР»РѕР¶РµРЅРЅС‹Р№ С„РёР»СЊРј/СЃРµСЂРёР°Р» */}
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
                              <div className={styles.suggestedMediaPlaceholder}>рџЋ¬</div>
                            )}
                            <div className={styles.suggestedMediaInfo}>
                              <span className={styles.suggestedMediaTitle}>{sm.title}</span>
                              <div className={styles.suggestedMediaMeta}>
                                <span className={styles.suggestedMediaType}>
                                  {sm.mediaType === 'movie' ? 'Р¤РёР»СЊРј' : 'РЎРµСЂРёР°Р»'}
                                </span>
                                {sm.voteAverage > 0 && (
                                  <span className={styles.suggestedMediaRating}>в… {sm.voteAverage.toFixed(1)}</span>
                                )}
                              </div>
                            </div>
                          </a>
                        );
                      })()}
                      
                      {/* Р’Р»РѕР¶РµРЅРёСЏ */}
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
                                  <span className={styles.attachmentIcon}>рџ“„</span>
                                  <span className={styles.attachmentName}>{attachment.originalName}</span>
                                  <span className={styles.attachmentSize}>
                                    {(attachment.size / 1024 / 1024).toFixed(2)} РњР‘
                                  </span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {message.sentViaBot && (
                        <div className={styles.botLabel}>
                          рџ“± РћС‚РІРµС‡РµРЅРѕ СЃ РїРѕРјРѕС‰СЊСЋ <a href="https://t.me/watchRebel_bot" target="_blank" rel="noopener noreferrer" className={styles.botLink}>Р±РѕС‚Р°</a>
                        </div>
                      )}
                      <div className={styles.messageFooter}>
                        <span className={styles.messageTime}>{formatTime(message.createdAt)}</span>
                        {(isOwnMessage || (isGroup && group?.canDeleteMessages)) && (
                          <button
                            className={styles.deleteButton}
                            onClick={(e) => handleDeleteClick(e, message.id, isOwnMessage)}
                            title="РЈРґР°Р»РёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ"
                          >
                            Г—
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
            {/* РљРЅРѕРїРєР° СЃРєСЂРѕР»Р»Р° РІРЅРёР· вЂ” РІРЅСѓС‚СЂРё messagesList */}
            {showScrollButton && (
            <button 
              className={styles.scrollDownButton}
              onClick={() => scrollToBottom(true)}
              title="Рљ РЅРѕРІС‹Рј СЃРѕРѕР±С‰РµРЅРёСЏРј"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
              </button>
            )}
          </div>
        )}
        
      </div>

      {/* Р¤РѕСЂРјР° РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ */}
      <form className={styles.inputForm} onSubmit={handleSendMessage}>
        <div className={styles.inputWrapper}>
          {/* РџСЂРµРІСЊСЋ РІС‹Р±СЂР°РЅРЅС‹С… С„Р°Р№Р»РѕРІ */}
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
                    <div className={styles.filePreviewIcon}>рџ“„</div>
                  )}
                  <span className={styles.filePreviewName}>{file.name}</span>
                  <button
                    type="button"
                    className={styles.fileRemoveButton}
                    onClick={() => handleRemoveFile(index)}
                  >
                    Г—
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
                    title="РџСЂРёРєСЂРµРїРёС‚СЊ"
                  >
                    <Icon name="paperclip" size="medium" />
                  </button>
                  {showAttachDropdown && (
                    <AttachmentDropdown
                      onSelect={handleAttachmentSelect}
                      onClose={() => setShowAttachDropdown(false)}
                      isGroup={isGroup}
                    />
                  )}
                </div>
                <div className={styles.inputFieldWrapper} style={{ position: 'relative' }}>
                  <textarea
                    ref={textareaRef}
                    className={styles.input}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isGroup ? "РќР°РїРёС€РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ..." : "РќР°РїРёС€РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ..."}
                    rows={1}
                    disabled={sendingMessage}
                  />
                  {isGroup && (
                    <MentionAutocomplete
                      textareaRef={textareaRef}
                      onMentionSelect={() => {}}
                      onTextChange={(text) => setMessageText(text)}
                      position="top"
                    />
                  )}
                  <div className={styles.inputActions}>
                    <button
                      type="button"
                      className={styles.emojiButton}
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="Р­РјРѕРґР·Рё"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
                        <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
                        <path d="M8 14.5C8.5 15.5 10 17 12 17C14 17 15.5 15.5 16 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                    {messageText.trim() && (
                      <button
                        type="button"
                        className={styles.clearInputButton}
                        onClick={() => setMessageText('')}
                        title="РћС‡РёСЃС‚РёС‚СЊ"
                      >
                        вњ•
                      </button>
                    )}
                  </div>
                  {showEmojiPicker && (
                    <div className={styles.emojiPickerWrapper}>
                      <ReactionPicker
                        onSelect={handleEmojiSelect}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}
                </div>
                {hasContent ? (
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={(!messageText.trim() && selectedFiles.length === 0) || sendingMessage}
                  >
                    {sendingMessage ? '...' : 'вћ¤'}
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
                    title="Р—Р°Р¶РјРёС‚Рµ РґР»СЏ Р·Р°РїРёСЃРё"
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
      
      {/* РњРѕРґР°Р»РєР° РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР° РёР·РѕР±СЂР°Р¶РµРЅРёР№ */}
      {showImageModal && (
        <div className={styles.imageModal} onClick={() => setShowImageModal(false)}>
          <div className={styles.imageModalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.imageModalClose}
              onClick={() => setShowImageModal(false)}
            >
              Г—
            </button>
            
            {modalImages.length > 1 && (
              <>
                <button
                  className={styles.imageModalPrev}
                  onClick={() => setCurrentImageIndex((currentImageIndex - 1 + modalImages.length) % modalImages.length)}
                >
                  вЂ№
                </button>
                <button
                  className={styles.imageModalNext}
                  onClick={() => setCurrentImageIndex((currentImageIndex + 1) % modalImages.length)}
                >
                  вЂє
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
                  Р РµР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ: {imageDimensions.natural.width}Г—{imageDimensions.natural.height} | 
                  РўРµРєСѓС‰РёР№ СЂР°Р·РјРµСЂ: {imageDimensions.displayed.width}Г—{imageDimensions.displayed.height}
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
        isAnnouncement={deleteIsAnnouncement}
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
      {showAnnouncementModal && (
        <AnnouncementModal
          conversationId={effectiveConversation.id}
          onClose={() => setShowAnnouncementModal(false)}
          onSent={(msg) => {
            dispatch({ type: 'messages/addNewMessage', payload: msg });
          }}
        />
      )}
      {showMembersModal && isGroup && (
        <GroupMembersModal
          conversationId={effectiveConversation.id}
          isCreator={effectiveConversation.createdBy === user.id}
          onClose={() => setShowMembersModal(false)}
          onMembersUpdated={() => dispatch(fetchMessages({ conversationId: effectiveConversation.id }))}
        />
      )}
      {showGroupSettings && isGroup && (
        <GroupSettingsModal
          conversationId={effectiveConversation.id}
          currentName={effectiveConversation.groupName}
          currentAvatar={effectiveConversation.groupAvatar}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={(updateData) => {
            setConversationOverrides(prev => ({ ...prev, ...updateData }));
            setShowGroupSettings(false);
            dispatch(fetchConversations());
          }}
        />
      )}
      {showGroupAvatarModal && getAvatarUrl() && (
        <div className={styles.imageModal} onClick={() => setShowGroupAvatarModal(false)}>
          <div className={styles.imageModalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.imageModalClose}
              onClick={() => setShowGroupAvatarModal(false)}
            >
              Г—
            </button>
            <img
              src={
                getAvatarUrl().startsWith('/uploads/')
                  ? `${import.meta.env.VITE_API_URL || ''}${getAvatarUrl()}`
                  : getAvatarUrl()
              }
              alt={getDisplayName()}
              className={styles.imageModalImage}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MessageThread;
