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
            Node.js, Express, SQLite.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Источник данных</h2>
          <p>
            Данные о фильмах и сериалах получаем из TMDb API.
          </p>
          <div className={styles.tmdbInfo}>
            <a 
              href="https://www.themoviedb.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.tmdbLink}
            >
              <img 
                src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg"
                alt="TMDb Logo"
                className={styles.tmdbLogo}
              />
              <span>The Movie Database (TMDb)</span>
            </a>
          </div>
        </section>

        <div className={styles.backLink}>
          <Link to="/" className={styles.link}>← Вернуться на главную</Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
