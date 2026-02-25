/**
 * Загружает SVG sprite и вставляет его в DOM
 * Вызывается один раз при инициализации приложения
 */
export async function loadIconSprite() {
  try {
    const response = await fetch('/icons/icons-sprite.svg');
    if (!response.ok) {
      console.warn('Не удалось загрузить SVG sprite:', response.status);
      return;
    }
    
    const svgText = await response.text();
    
    // Создаем временный контейнер
    const div = document.createElement('div');
    div.innerHTML = svgText;
    
    // Получаем SVG элемент
    const svg = div.querySelector('svg');
    if (svg) {
      // Убеждаемся что SVG скрыт
      svg.style.display = 'none';
      svg.setAttribute('aria-hidden', 'true');
      
      // Вставляем в начало body
      document.body.insertBefore(svg, document.body.firstChild);
      
      console.log('SVG sprite успешно загружен');
    }
  } catch (error) {
    console.error('Ошибка при загрузке SVG sprite:', error);
  }
}
