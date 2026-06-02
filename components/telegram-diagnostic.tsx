'use client';

import { useEffect, useState } from 'react';

type TelegramUserInfo = {
  id: number;
  first_name: string;
  username?: string;
  photo_url?: string;
};

type DiagnosticState =
  | { status: 'loading' }
  | { status: 'sdk-not-loaded' }
  | { status: 'no-user-data'; initDataUnsafe: Record<string, unknown> }
  | { status: 'found'; user: TelegramUserInfo; initDataUnsafe: Record<string, unknown> };

export function TelegramDiagnostic() {
  const [state, setState] = useState<DiagnosticState>({ status: 'loading' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Даём SDK время на загрузку и инициализацию
    const timer = setTimeout(() => {
      console.log('[TelegramDiagnostic] window.Telegram:', window.Telegram);
      console.log('[TelegramDiagnostic] window.Telegram?.WebApp:', window.Telegram?.WebApp);

      const tg = window.Telegram?.WebApp;

      if (!tg) {
        setState({ status: 'sdk-not-loaded' });
        return;
      }

      tg.ready();

      const initDataUnsafe = tg.initDataUnsafe as Record<string, unknown>;
      console.log('[TelegramDiagnostic] initDataUnsafe:', initDataUnsafe);

      const rawUser = tg.initDataUnsafe.user;
      console.log('[TelegramDiagnostic] user:', rawUser);

      if (!rawUser) {
        setState({ status: 'no-user-data', initDataUnsafe });
        return;
      }

      const user: TelegramUserInfo = {
        id: rawUser.id,
        first_name: rawUser.first_name,
        username: rawUser.username,
        photo_url: rawUser.photo_url,
      };

      setState({ status: 'found', user, initDataUnsafe });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <div className="telegram-diagnostic">
      <button
        type="button"
        className="telegram-diagnostic__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Закрыть диагностику Telegram"
        title="Закрыть"
      >
        ✕
      </button>

      {state.status === 'loading' && (
        <p className="telegram-diagnostic__text">🔍 Проверка Telegram Mini App...</p>
      )}

      {state.status === 'sdk-not-loaded' && (
        <div className="telegram-diagnostic__info">
          <p className="telegram-diagnostic__text telegram-diagnostic__text--warn">
            ⚠️ Telegram SDK not loaded
          </p>
          <p className="telegram-diagnostic__text">
            Скрипт <code>https://telegram.org/js/telegram-web-app.js</code> не загрузился.
            Убедись, что приложение открыто внутри Telegram Mini App (через бота).
          </p>
        </div>
      )}

      {state.status === 'no-user-data' && (
        <div className="telegram-diagnostic__info">
          <p className="telegram-diagnostic__text telegram-diagnostic__text--warn">
            ⚠️ Telegram detected but no user data
          </p>
          <p className="telegram-diagnostic__text">
            SDK загружен, но объект пользователя пуст. Возможно, Mini App запущен без
            авторизации пользователя.
          </p>
          <details className="telegram-diagnostic__json">
            <summary>Full initDataUnsafe</summary>
            <pre>{JSON.stringify(state.initDataUnsafe, null, 2)}</pre>
          </details>
        </div>
      )}

      {state.status === 'found' && (
        <div className="telegram-diagnostic__info">
          <p className="telegram-diagnostic__text telegram-diagnostic__text--ok">
            ✅ Telegram detected
          </p>
          <div className="telegram-diagnostic__user">
            {state.user.photo_url && (
              <img
                src={state.user.photo_url}
                alt="User photo"
                className="telegram-diagnostic__avatar"
              />
            )}
            <ul className="telegram-diagnostic__list">
              <li><strong>User ID:</strong> {state.user.id}</li>
              <li><strong>First Name:</strong> {state.user.first_name}</li>
              <li><strong>Username:</strong> {state.user.username ?? '—'}</li>
              <li><strong>Photo URL:</strong> {state.user.photo_url ?? '—'}</li>
            </ul>
          </div>
          <details className="telegram-diagnostic__json">
            <summary>Full initDataUnsafe</summary>
            <pre>{JSON.stringify(state.initDataUnsafe, null, 2)}</pre>
          </details>
          <details className="telegram-diagnostic__json">
            <summary>Full user object</summary>
            <pre>{JSON.stringify(state.user, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
