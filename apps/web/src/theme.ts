import { createTheme } from '@mantine/core';

/**
 * Mantine 主题配置 - 日系极简风格
 * - 单强调色（#7aa2f7）
 * - 大圆角（radius: 'md'/'lg'）
 * - 轻阴影
 * - 干净排版
 */
export const theme = createTheme({
  primaryColor: 'blue',
  colors: {
    blue: [
      '#e7f1ff',
      '#c7dffd',
      '#a3c9fa',
      '#7aa2f7', // 主强调色
      '#5a8ef4',
      '#3d7af1',
      '#2b6aef',
      '#1d5aed',
      '#0f4aeb',
      '#003ae9',
    ],
  },
  spacing: {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '12px', // 大圆角
    lg: '16px', // 大圆角
    xl: '20px',
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.08)',
    md: '0 2px 6px rgba(0, 0, 0, 0.1)', // 轻阴影
    lg: '0 4px 12px rgba(0, 0, 0, 0.12)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: '500',
  },
  defaultRadius: 'md',
});

