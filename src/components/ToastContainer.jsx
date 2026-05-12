import { AnimatePresence, motion } from "framer-motion";
import { FiAlertCircle, FiBell, FiCheckCircle, FiX } from "react-icons/fi";

const toastIcons = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  info: FiBell,
};

export default function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type] || FiBell;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`toast ${toast.type}`}
            >
              <div className="toast-icon-wrap">
                <Icon className="toast-icon" />
              </div>
              <div className="toast-copy">
                <div className="toast-title">{toast.title || toast.message}</div>
                {toast.description ? <div className="toast-description">{toast.description}</div> : null}
              </div>
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss notification"
                onClick={() => onDismiss?.(toast.id)}
              >
                <FiX />
              </button>
              <div className="toast-progress" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
