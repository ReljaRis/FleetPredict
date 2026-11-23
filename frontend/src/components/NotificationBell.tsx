import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, FileText, TriangleAlert } from 'lucide-react'
import { Button, Drawer, useToast } from './ui'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import { ago } from '../lib/format'
import type { AppNotification, NotificationsResponse } from '../lib/types'

const CHANNEL_NOTE: Record<string, string> = {
  EMAIL_SENT: 'Also sent by email',
  EMAIL_FAILED: 'Email could not be sent',
  EMAIL_NOT_CONFIGURED: 'Email is not set up on this server, so this is shown here only',
}

/** Bell with an unread count that opens the list of notifications. Refreshes every minute. */
export function NotificationBell({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, reload } = useApi<NotificationsResponse>('/notifications')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setInterval(reload, 60_000)
    return () => clearInterval(t)
  }, [reload])

  const unread = data?.unread ?? 0

  async function markAll() {
    setBusy(true)
    try {
      await api('/notifications/read', { body: {} })
      reload()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function openItem(n: AppNotification) {
    if (!n.read) api('/notifications/read', { body: { ids: [n.id] } }).then(reload).catch(() => undefined)
    setOpen(false)
    if (n.vehicleId) navigate(`/app/fleet/${n.vehicleId}?tab=${n.kind === 'DOCUMENT' ? 'documents' : 'report'}`)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); reload() }}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={`relative rounded-md p-2 transition-colors ${tone === 'dark' ? 'text-white/70 hover:bg-night-2 hover:text-white' : 'text-ink-2 hover:bg-sunken hover:text-ink'}`}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-critical px-1 text-[10px] font-semibold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        sub={data && !data.inAppEnabled ? 'In-app notifications are switched off in Settings.' : unread ? `${unread} unread` : 'Everything is read'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <Button variant="primary" loading={busy} disabled={!unread} onClick={markAll}>Mark all as read</Button>
          </>
        }
      >
        {!data?.items.length ? (
          <p className="text-sm text-ink-3">{data && !data.inAppEnabled ? 'Turn in-app notifications on under Settings, Notifications.' : 'No notifications yet. Document expiry reminders and critical maintenance alerts appear here.'}</p>
        ) : (
          <ul className="-mx-6 divide-y divide-line border-y border-line">
            {data.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 px-6 py-3.5 text-left transition-colors hover:bg-canvas">
                  <span className="mt-0.5">{n.kind === 'DOCUMENT' ? <FileText className="size-4 text-ink-3" /> : <TriangleAlert className="size-4 text-high" />}</span>
                  <span className="min-w-0">
                    <span className="flex items-start justify-between gap-3">
                      <span className={`text-[15px] ${n.read ? 'text-ink-2' : 'font-semibold text-ink'}`}>{n.title}</span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-critical" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-3">{n.body}</span>
                    <span className="mt-1 block text-xs text-ink-3">{ago(n.createdAt)}{CHANNEL_NOTE[n.channel] ? ` · ${CHANNEL_NOTE[n.channel]}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  )
}
