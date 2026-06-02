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
  | { status: 'not-found' }
  | { status: 'found'; user: TelegramUserInfo | null; rawInitData: string };

export function TelegramDiagnostic() {
  const [state, setState] = useState<DiagnosticState>({ status: 'loading' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Даём Telegram WebApp время на инициализацию
    const timer = setTimeout(() => {
      const tg = window.Telegram?.WebApp;

      if (!tg) {
        setState({ status: 'not-found' });
        return;
      }

      tg.ready();

      const rawUser = tg.initDataUnsafe.user;
      const user: TelegramUserInfo | null = rawUser
        ? {
            id: rawUser.id,
            first_name: rawUser.first_name,
            username: rawUser.username,
            photo_url: rawUser.photo_url,
          }
        : null;

      console.log('[TelegramDiagnostic] initDataUnsafe:', tg.initDataUnsafe);
      console.log('[TelegramDiagnostic] user:', rawUser);

      setState({
        status: 'found',
        user,
        rawInitData: tg.initData,
      });
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
      {state.status === 'not-found' && (
        <p className="telegram-diagnostic__text telegram-diagnostic__text--warn">
          ⚠️ Not running inside Telegram
        </p>
      )}
      {state.status === 'found' && (
        <div className="telegram-diagnostic__info">
          <p className="telegram-diagnostic__text telegram-diagnostic__text--ok">
            ✅ Telegram detected
          </p>
          {state.user ? (
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
              {state.rawInitData && (
                <details className="telegram-diagnostic__json">
                  <summary>Full JSON (initDataUnsafe)</summary>
                  <pre>{JSON.stringify(state.user, null, 2)}</pre>
                </details>
              )}
            </div>
          ) : (
            <p className="telegram-diagnostic__text">
              User object is empty — пользователь не авторизован в Telegram Mini App.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
