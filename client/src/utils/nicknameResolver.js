import api from '../services/api';

let nicknamesCache = {};
let nicknameDisplayMode = 'name';

export const setNicknames = (nicknames) => {
  nicknamesCache = nicknames;
};

export const setNicknameDisplayMode = (mode) => {
  nicknameDisplayMode = mode;
};

export const getNicknames = () => nicknamesCache;

export const fetchNicknames = async () => {
  try {
    const response = await api.get('/users/nicknames/all');
    nicknamesCache = response.data;
    return response.data;
  } catch (error) {
    console.error('Error fetching nicknames:', error);
    return {};
  }
};

export const resolveDisplayName = (userId, displayName) => {
  const nickname = nicknamesCache[userId];
  
  if (!nickname || !displayName) {
    return displayName || 'Пользователь';
  }

  switch (nicknameDisplayMode) {
    case 'nickname':
      return nickname;
    case 'both':
      return `${displayName} (${nickname})`;
    case 'name':
    default:
      return displayName;
  }
};

export const resolveDisplayNameWithTooltip = (userId, displayName) => {
  const nickname = nicknamesCache[userId];
  
  if (!nickname || !displayName || nicknameDisplayMode === 'name') {
    return { text: displayName || 'Пользователь', tooltip: null };
  }

  switch (nicknameDisplayMode) {
    case 'nickname':
      return { text: nickname, tooltip: displayName };
    case 'both':
      return { text: `${displayName} (${nickname})`, tooltip: null };
    default:
      return { text: displayName, tooltip: null };
  }
};
