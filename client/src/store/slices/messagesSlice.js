import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { APIError, NetworkError } from '../../services/api';

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
  async ({ conversationId, limit = 50, offset = 0 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/messages/${conversationId}?limit=${limit}&offset=${offset}`);
      return { conversationId, ...response.data, offset };
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Отправить новое сообщение
export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async ({ receiverId, content, files = [] }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('receiverId', receiverId);
      formData.append('content', content || '');
      
      // Добавляем файлы
      files.forEach(file => {
        formData.append('attachments', file);
      });
      
      const response = await api.post('/messages', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      return handleError(error, rejectWithValue);
    }
  }
);

// Удалить сообщение
export const deleteMessage = createAsyncThunk(
  'messages/deleteMessage',
  async (messageId, { rejectWithValue }) => {
    try {
      await api.delete(`/messages/${messageId}`);
      return messageId;
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
    },
    addNewMessage: (state, action) => {
      // Добавляем новое сообщение только если оно для текущего диалога
      const message = action.payload;
      if (message.conversationId === state.currentConversation) {
        // Проверяем что сообщение еще не добавлено
        const exists = state.messages.some(m => m.id === message.id);
        if (!exists) {
          state.messages.push(message);
        }
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
        const { messages, pagination, offset } = action.payload;
        
        if (offset > 0) {
          // Добавляем старые сообщения в начало
          state.messages = [...messages, ...state.messages];
          state.loadingMore = false;
        } else {
          // Заменяем все сообщения (первая загрузка или обновление)
          state.messages = messages;
          state.loading = false;
        }
        
        state.currentConversation = action.payload.conversationId;
        state.hasMoreMessages = pagination.hasMore;
        state.totalMessages = pagination.total;
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
        state.messages = state.messages.filter(m => m.id !== action.payload);
        state.error = null;
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { clearError, setCurrentConversation, clearMessages, addNewMessage } = messagesSlice.actions;
export default messagesSlice.reducer;
