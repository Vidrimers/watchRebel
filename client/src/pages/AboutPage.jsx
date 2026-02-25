import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Common/Icon';
import styles from './AboutPage.module.css';

/**
 * Страница "О проекте"
 * Информация о watchRebel и его возможностях
 */
const AboutPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>О проекте watchRebel</h1>
        
        <section className={styles.section}>
          <h2>Что такое watchRebel?</h2>
          <p>
            watchRebel — это социальная сеть для любителей кино и сериалов. 
            Здесь вы можете вести учет просмотренного контента, делиться впечатлениями 
            с друзьями и находить новые фильмы для просмотра.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Основные возможности</h2>
          <ul className={styles.featureList}>
            <li><Icon name="edit" size="small" /> Создавайте собственные списки фильмов и сериалов</li>
            <li><Icon name="star" size="small" /> Оценивайте просмотренный контент от 1 до 10</li>
            <li><Icon name="tv" size="small" /> Отслеживайте прогресс просмотра сериалов</li>
            <li><Icon name="friends" size="small" /> Добавляйте друзей и следите за их активностью</li>
            <li><Icon name="messages" size="small" /> Делитесь отзывами и реакциями на записи друзей</li>
            <li><Icon name="notifications" size="small" /> Получайте уведомления о действиях друзей в Telegram</li>
            <li><Icon name="settings" size="small" /> Выбирайте из множества тем оформления</li>
            <li><Icon name="search" size="small" /> Ищите фильмы, сериалы и других пользователей</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Технологии</h2>
          <p>
            Проект построен на современном стеке технологий: React, Redux Toolkit, 
            Node.js, Express, SQLite. Данные о фильмах и сериалах получаем из TMDb API.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Контакты</h2>
          <p>
            По вопросам сотрудничества и рекламы обращайтесь к администратору проекта.
          </p>
        </section>

        <div className={styles.backLink}>
          <Link to="/" className={styles.link}>← Вернуться на главную</Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
