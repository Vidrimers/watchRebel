import React from 'react';
import UserPageLayout from './components/Layout/UserPageLayout';

function App() {
  // Временные данные пользователя для демонстрации
  const mockUser = {
    id: '1',
    displayName: 'Пользователь',
    avatarUrl: null,
    isAdmin: false
  };

  return (
    <div className="app">
      <UserPageLayout user={mockUser}>
        {/* Здесь будет Wall компонент */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h1>watchRebel</h1>
          <p>Социальная сеть для любителей кино</p>
          <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>
            Layout компоненты успешно созданы! Здесь будет отображаться Wall пользователя.
          </p>
        </div>
      </UserPageLayout>
    </div>
  );
}

export default App;
