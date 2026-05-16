import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, AlertCircle, Clock, Edit3, Filter } from 'lucide-react'
import { notificationAPI } from '../utils/api'

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'promotion_due', label: 'Promotion due' },
  { value: 'retirement_soon', label: 'Retirement soon' },
  { value: 'record_updated', label: 'Record updated' },
]

const READ_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'false', label: 'Unread' },
  { value: 'true', label: 'Read' },
]

const TYPE_META = {
  promotion_due: { label: 'Promotion due', icon: AlertCircle, css: 'warning' },
  retirement_soon: { label: 'Retirement soon', icon: Clock, css: 'danger' },
  record_updated: { label: 'Record updated', icon: Edit3, css: 'info' },
}

const Notifications = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [nextPage, setNextPage] = useState(null)
  const [prevPage, setPrevPage] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    type: '',
    is_read: '',
    date_from: '',
    date_to: '',
  })

  const fetchPage = useCallback(async (pageNum = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = { page: pageNum }
      if (filters.type) params.type = filters.type
      if (filters.is_read) params.is_read = filters.is_read
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      const res = await notificationAPI.list(params)
      const data = res.data
      setItems(data.results || [])
      setCount(data.count || 0)
      setNextPage(data.next ? pageNum + 1 : null)
      setPrevPage(data.previous ? pageNum - 1 : null)
      setPage(pageNum)
    } catch (err) {
      setError('Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchPage(1)
  }, [fetchPage])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleClearFilters = () => {
    setFilters({ type: '', is_read: '', date_from: '', date_to: '' })
  }

  const handleMarkOne = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    try {
      await notificationAPI.markRead(id)
    } catch {
      fetchPage(page)
    }
  }

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await notificationAPI.markAllRead()
    } catch {
      fetchPage(page)
    }
  }

  const handleRowClick = (n) => {
    if (!n.is_read) handleMarkOne(n.id)
    if (n.staff_member_id) navigate(`/staff/${n.staff_member_id}`)
  }

  return (
    <div className="notifications-page">
      <div className="page-header">
        <div>
          <h2 className="page-title"><Bell size={20} /> All Notifications</h2>
          <p className="page-subtitle">{count} total · showing page {page}</p>
        </div>
        <button className="btn btn-secondary" onClick={handleMarkAll}>
          <CheckCheck size={16} /> Mark all as read
        </button>
      </div>

      <div className="filter-bar">
        <Filter size={16} />
        <label>
          Type
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filters.is_read}
            onChange={(e) => handleFilterChange('is_read', e.target.value)}
          >
            {READ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </label>
        <button className="btn btn-tertiary" onClick={handleClearFilters}>Clear</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="notifications-list-full">
        {loading && <div className="notification-empty">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="notification-empty">No notifications match the current filters.</div>
        )}
        {!loading && items.map((n) => {
          const meta = TYPE_META[n.type] || { label: n.type, icon: Bell, css: 'info' }
          const Icon = meta.icon
          return (
            <div
              key={n.id}
              className={`notification-row ${n.is_read ? '' : 'unread'} ${meta.css}`}
              onClick={() => handleRowClick(n)}
              role="button"
              tabIndex={0}
            >
              <div className={`notification-icon ${meta.css}`}>
                <Icon size={18} />
              </div>
              <div className="notification-body">
                <div className="notification-meta">
                  <span className="notification-type">{meta.label}</span>
                  {n.staff_member_staff_id && (
                    <span className="notification-staff">{n.staff_member_staff_id} — {n.staff_member_name}</span>
                  )}
                  <span className="notification-time">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <div className="notification-message">{n.message}</div>
              </div>
              {!n.is_read && (
                <button
                  className="notification-mark"
                  title="Mark as read"
                  onClick={(e) => { e.stopPropagation(); handleMarkOne(n.id) }}
                >
                  <Check size={14} /> Mark read
                </button>
              )}
            </div>
          )
        })}
      </div>

      {(prevPage || nextPage) && (
        <div className="pagination">
          <button
            className="btn btn-secondary"
            disabled={!prevPage}
            onClick={() => fetchPage(prevPage)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="btn btn-secondary"
            disabled={!nextPage}
            onClick={() => fetchPage(nextPage)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default Notifications
