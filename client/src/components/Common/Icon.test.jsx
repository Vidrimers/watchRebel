import React from 'react';
import { render, screen } from '@testing-library/react';
import Icon from './Icon';

describe('Icon Component', () => {
  test('renders icon with default size', () => {
    const { container } = render(<Icon name="feed" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveStyle({ width: '24px', height: '24px' });
  });

  test('renders icon with small size', () => {
    const { container } = render(<Icon name="heart" size="small" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ width: '16px', height: '16px' });
  });

  test('renders icon with large size', () => {
    const { container } = render(<Icon name="settings" size="large" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ width: '32px', height: '32px' });
  });

  test('renders icon with custom color', () => {
    const { container } = render(<Icon name="notifications" color="#e53e3e" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ color: '#e53e3e' });
  });

  test('renders icon with custom className', () => {
    const { container } = render(<Icon name="messages" className="custom-class" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('custom-class');
  });

  test('renders icon with numeric size', () => {
    const { container } = render(<Icon name="star" size={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ width: '40px', height: '40px' });
  });

  test('uses correct icon href', () => {
    const { container } = render(<Icon name="catalog" />);
    const use = container.querySelector('use');
    expect(use).toHaveAttribute('href', '/icons/icons-sprite.svg#icon-catalog');
  });

  test('has aria-hidden attribute', () => {
    const { container } = render(<Icon name="friends" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  test('has focusable false attribute', () => {
    const { container } = render(<Icon name="movies" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('focusable', 'false');
  });
});
