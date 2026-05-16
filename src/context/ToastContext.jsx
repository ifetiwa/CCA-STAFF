import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let idSeed = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = ++idSeed;
    setToasts((prev) => [...prev, { id, kind: 'info', duration: 3500, ...toast }]);
    if (toast?.duration !== 0) {
      setTimeout(() => remove(id), toast?.duration || 3500);
    }
  }, [remove]);

  const api = {
    push,
    success: (message, opts) => push({ ...opts, kind: 'success', message }),
    error:   (message, opts) => push({ ...opts, kind: 'error',   message }),
    info:    (message, opts) => push({ ...opts, kind: 'info',    message }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon">
              {t.kind === 'success' ? <CheckCircle2 size={18} />
                : t.kind === 'error'   ? <AlertTriangle size={18} />
                                       : <Info size={18} />}
            </span>
            <span className="toast-body">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Close">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
