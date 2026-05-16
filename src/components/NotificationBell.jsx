import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, AlertCircle, Clock, Edit3 } from 'lucide-react'
import { notificationAPI } from '../utils/api'

const TYPE_META = {
  promotion_due: { label: 'Promotion due', icon: AlertCircle, css: 'warning' },
  retirement_soon: { label: 'Retirement soon', icon: Clock, css: 'danger' },
  record_updated: { label: 'Record updated', icon: Edit3, css: 'info' },
}

const POLL_MS = 60_000

function formatRelative(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  const diffMs = Date.now() - then.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return then.toLocaleDateString()
}

const NotificationBell = () => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const res = await notificationAPI.recent(10)
      setItems(res.data.results || [])
      setUnread(res.data.unread || 0)
    } catch {
      // Backend offline / 401 — silently degrade.
      setItems([])
      setUnread(0)
    }
  }, [])

  // Initial fetch + polling for the unread badge.
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Click-outside to close the dropdown.
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      await refresh()
      setLoading(false)
    }
  }

  const handleMarkOne = async (id, e) => {
    e.stopPropagation()
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await notificationAPI.markRead(id)
    } catch {
      refresh()
    }
  }

  const handleMarkAll = async (e) => {
    e.stopPropagation()
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnread(0)
    try {
      await notificationAPI.markAllRead()
    } catch {
      refresh()
    }
  }

  const handleViewAll = () => {
    setOpen(false)
    navigate('/notifications')
  }

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={handleMarkAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading && <div className="notification-empty">Loading…</div>}
            {!loading && items.length === 0 && (
              <div className="notification-empty">You're all caught up.</div>
            )}
            {!loading &&
              items.map((n) => {
                const meta = TYPE_META[n.type] || { label: n.type, icon: Bell, css: 'info' }
                const Icon = meta.icon
                return (
                  <div
                    key={n.id}
                    className={`notification-item ${n.is_read ? '' : 'unread'} ${meta.css}`}
                  >
                    <div className={`notification-icon ${meta.css}`}>
                      <Icon size={16} />
                    </div>
                    <div className="notification-body">
                      <div className="notification-meta">
                        <span className="notification-type">{meta.label}</span>
                        <span className="notification-time">{formatRelative(n.created_at)}</span>
                      </div>
                      <div className="notification-message">{n.message}</div>
                    </div>
                    {!n.is_read && (
                      <button
                        className="notification-mark"
                        title="Mark as read"
                        onClick={(e) => handleMarkOne(n.id, e)}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
          </div>

          <div className="notification-dropdown-footer">
            <button className="link-btn" onClick={handleViewAll}>
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
