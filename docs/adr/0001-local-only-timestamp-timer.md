# Local-only app with a timestamp-based timer and no notifications while closed

Pomodorox is a single-user PWA that keeps all data on the device, with no accounts, sync or backend. Without a server there is no push channel, and browsers have dropped scheduled-notification APIs, so a Session end can only be announced while the app is open (foreground or background); we accept that rather than add a backend in v1.

The timer is derived from the Session's stored start time and accumulated pause time, never from counting ticks, so it survives background-tab throttling and the app being closed. On reopen, a Session whose time has already elapsed is recorded as Completed at its scheduled end (counting a Pomodoro for Work), silently, without sound or notification.

## Considered Options

- **Server push (Web Push via a backend, e.g. Supabase)**: reliable end-of-session notifications even when closed, but needs accounts, a server and subscription management; rejected for v1.
- **Abandon a Session that ends while the app is closed**: simpler, but punishes closing the laptop lid after 25 minutes of real work.
