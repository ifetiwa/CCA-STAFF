// Shared helpers for turning a raw Django user payload into the shape the
// React app uses everywhere (AuthContext, Login). Keeping this in one place
// means the online-login path and the session-refresh path produce identical
// user objects.

export const initialsFor = (name = '', email = '') => {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name[0] || email[0] || 'U').toUpperCase() + (name[1] || email[1] || '').toUpperCase()
}

// Accepts either the `/accounts/login/` `data.user` object or the
// `/accounts/me/` payload — both are the same user serializer.
export const normalizeUser = (u = {}) => {
  const fullName =
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(' ') ||
    u.username ||
    u.email
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: fullName,
    role: u.role_display || u.role,
    role_key: u.role,
    is_superuser: Boolean(u.is_superuser) || u.role === 'super_admin',
    permissions: u.permissions || {},
    initials: initialsFor(fullName, u.email),
  }
}
