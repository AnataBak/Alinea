'use client';

import { LiveConsole } from '@/components/live-console';
import { TelegramDiagnostic } from '@/components/telegram-diagnostic';

export default function HomePage() {
  return (
    <main className="page-shell">
      <TelegramDiagnostic />
      <LiveConsole />
    </main>
  );
}
