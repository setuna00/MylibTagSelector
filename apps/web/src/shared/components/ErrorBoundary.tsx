import React from 'react';
import { error as loggerError } from '../../utils/logger';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // 保留日志，方便定位
    loggerError('[TagSelector] Uncaught render error:', error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('tagselector-taxonomy');
      localStorage.removeItem('tagselector-selection');
      localStorage.removeItem('tagselector-rules');
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = Boolean(import.meta.env?.DEV);
    const message = this.state.error?.message ?? 'Unknown error';

    return (
      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 8px' }}>应用发生错误</h2>
        <p style={{ margin: '0 0 16px', opacity: 0.8 }}>
          页面渲染时出现异常。你可以刷新，或清除本地缓存后重新进入。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={this.handleReload} style={{ padding: '8px 12px', cursor: 'pointer' }}>
            刷新页面
          </button>
          <button
            onClick={this.handleClearCacheAndReload}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            清除缓存并刷新
          </button>
        </div>

        {isDev && (
          <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.9 }}>
            {message}
            {'\n\n'}
            {this.state.error?.stack ?? ''}
          </pre>
        )}
      </div>
    );
  }
}

