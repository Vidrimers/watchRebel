import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';
import { isEncryptedMessage, decryptMessage, getSessionKey, extractRotationCounter, getSessionKeyByRotation, isEncryptedGroupMessage, decryptGroupMessage, getGroupKey, getGroupKeyByVersion, extractGroupKeyVersion } from '../../services/e2ee';

// Вспомогательная функция для обработки ошибок
const handleError = (error, rejectWithValue) => {
  if (error instanceof APIError) {
    return rejectWithValue(error.data || error.message);
  } else if (error instanceof NetworkError) {
    return rejectWithValue({ message: error.message });
  }
  return rejectWithValue({ message: 'Неизвестная ошибка' });
};

// Получить список всех диалогов
export const fetchConversations = createAsyncThunk(
  'messages/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/messages/conversations');
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Получить сообщения из конкретного диалога
export const fetchMessages = createAsyncThunk(
  'messages/fetchMessages',
  async ({ conversationId, limit = 50, offset = 0, isSecret = false, isGroup = false }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/messages/${conversationId}?limit=${limit}&offset=${offset}`);
      let messages = response.data.messages || [];

      // Расшифровка сообщений для секретных чатов и групп
      if (isSecret && messages.length > 0) {
        messages = await Promise.all(
          messages.map(async (msg) => {
            try {
              if (isGroup && isEncryptedGroupMessage(msg.content)) {
                // Секретная группа — используем групповый ключ (с учётом версии)
                const keyVersion = extractGroupKeyVersion(msg.content);
                const groupKeyData = getGroupKey(conversationId);
                const groupKey = (groupKeyData && groupKeyData.version === keyVersion)
                  ? groupKeyData.key
                  : getGroupKeyByVersion(conversationId, keyVersion);
                if (groupKey) {
                  msg = { ...msg, content: await decryptGroupMessage(msg.content, groupKey) };
                } else {
                  // Нет ключа для этой версии — показываем placeholder
                  msg = { ...msg, content: '🔒 Сообщение не расшифровывается', undecryptable: true };
                }
              } else if (isEncryptedMessage(msg.content)) {
                // Секретный чат 1-на-1 — используем session key
                const rotationCounter = extractRotationCounter(msg.content);
                const sessionKey = getSessionKeyByRotation(conversationId, rotationCounter) || getSessionKey(conversationId);
                if (sessionKey) {
                  msg = { ...msg, content: await decryptMessage(msg.content, sessionKey) };
                } else {
                  msg = { ...msg, content: '🔒 Сообщение не расшифровывается', undecryptable: true };
                }
              }
            } catch (err) {
              console.error('Ошибка расшифровки сообщения:', err);
              if (isEncryptedGroupMessage(msg.content) || isEncryptedMessage(msg.content)) {
                msg = { ...msg, content: '🔒 Сообщение не расшифровывается', undecryptable: true };
              }
            }
            return msg;
          })
        );
      }

      return { conversationId, ...response.data, messages, offset };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Отправить новое сообщение
export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async ({ receiverId, content, files = [], location = null, suggestedMedia = null, originalContent = null, replyTo = null, forwardFrom = null, forwardMessageId = null }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('receiverId', receiverId);
      formData.append('content', content || '');
      if (location) {
        formData.append('location', JSON.stringify(location));
      }
      if (suggestedMedia) {
        formData.append('suggestedMedia', JSON.stringify(suggestedMedia));
      }
      if (replyTo) {
        formData.append('replyTo', replyTo);
      }
      if (forwardFrom) {
        formData.append('forwardFrom', forwardFrom);
      }
      if (forwardMessageId) {
        formData.append('forwardMessageId', forwardMessageId);
      }

      // Добавляем файлы
      files.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await api.post('/messages', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Для секретных чатов: заменяем зашифрованный content на оригинальный plaintext
      if (originalContent !== null) {
        response.data = { ...response.data, content: originalContent };
      }

      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Удалить сообщение
export const deleteMessage = createAsyncThunk(
  'messages/deleteMessage',
  async ({ messageId, deleteType = 'for_me' }, { rejectWithValue }) => {
    try {
      await api.delete(`/messages/${messageId}?deleteType=${deleteType}`);
      return { messageId, deleteType };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Закрепить/открепить сообщение
export const pinMessage = createAsyncThunk(
  'messages/pinMessage',
  async ({ messageId }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/messages/${messageId}/pin`);
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Получить закреплённое сообщение
export const fetchPinnedMessage = createAsyncThunk(
  'messages/fetchPinnedMessage',
  async ({ conversationId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/messages/pinned/${conversationId}`);
      return response.data.pinnedMessage;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState: {
    conversations: [],
    currentConversation: null,
    messages: [],
    group: null,
    pinnedMessage: null,
    hasMoreMessages: false,
    totalMessages: 0,
    loading: false,
    loadingMore: false,
    sendingMessage: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },
    clearMessages: (state) => {
      state.messages = [];
      state.currentConversation = null;
      state.pinnedMessage = null;
    },
    addNewMessage: (state, action) => {
      const message = action.payload;
      if (message.conversationId === state.currentConversation) {
        const exists = state.messages.some(m => m.id === message.id);
        if (!exists) {
          state.messages.push(message);
        }
      }
    },
    removeMessage: (state, action) => {
      const messageId = action.payload;
      state.messages = state.messages.filter(m => m.id !== messageId);
    },
    setPinnedMessage: (state, action) => {
      state.pinnedMessage = action.payload;
    },
    clearPinnedMessage: (state) => {
      state.pinnedMessage = null;
    },
    patchMessageReplyTo: (state, action) => {
      const { messageId, replyTo } = action.payload;
      const msg = state.messages.find(m => m.id === messageId);
      if (msg) {
        msg.replyTo = replyTo;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Conversations
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Messages
      .addCase(fetchMessages.pending, (state, action) => {
        // Если offset > 0, это загрузка старых сообщений
        if (action.meta.arg.offset > 0) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { messages, pagination, offset, group } = action.payload;

        if (offset > 0) {
          state.messages = [...messages, ...state.messages];
          state.loadingMore = false;
        } else {
          state.messages = messages;
          state.loading = false;
        }

        state.currentConversation = action.payload.conversationId;
        state.group = group || null;
        if (pagination) {
          state.hasMoreMessages = pagination.hasMore;
          state.totalMessages = pagination.total;
        }
        state.error = null;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload;
      })
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.sendingMessage = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        // Добавляем новое сообщение в список
        state.messages.push(action.payload);
        state.sendingMessage = false;
        state.error = null;
        
        // Обновляем список диалогов
        const conversation = state.conversations.find(
          c => c.id === action.payload.conversationId
        );
        if (conversation) {
          conversation.lastMessage = action.payload.content;
          conversation.lastMessageAt = action.payload.createdAt;
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sendingMessage = false;
        state.error = action.payload;
      })
      // Delete Message
      .addCase(deleteMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        const { messageId } = action.payload;
        state.messages = state.messages.filter(m => m.id !== messageId);
        state.error = null;
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Pin Message
      .addCase(pinMessage.fulfilled, (state, action) => {
        const { messageId, isPinned } = action.payload;
        const msg = state.messages.find(m => m.id === messageId);
        if (msg) {
          msg.isPinned = isPinned;
        }
        // Если открепили — очищаем pinnedMessage
        if (!isPinned && state.pinnedMessage?.id === messageId) {
          state.pinnedMessage = null;
        }
      })
      .addCase(pinMessage.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch Pinned Message
      .addCase(fetchPinnedMessage.fulfilled, (state, action) => {
        state.pinnedMessage = action.payload;
      });
  }
});

export const { clearError, setCurrentConversation, clearMessages, addNewMessage, removeMessage, setPinnedMessage, clearPinnedMessage } = messagesSlice.actions;
export default messagesSlice.reducer;
