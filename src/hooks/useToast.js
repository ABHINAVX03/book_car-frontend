import { useState, useCallback, useEffect, useRef } from "react";

let id = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timeoutIdsRef = useRef(new Set());

  const dismissToast = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const addToast = useCallback((input, type = 'info', duration = 3500) => {
    const tid = ++id;
    const payload = typeof input === "string"
      ? { title: input, message: input, type, duration }
      : {
          ...input,
          message: input?.message || input?.title || "",
          type: input?.type || type,
          duration: input?.duration || duration,
        };

    setToasts((current) => [...current, { id: tid, ...payload }]);
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      dismissToast(tid);
    }, payload.duration);
    timeoutIdsRef.current.add(timeoutId);
  }, [dismissToast]);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutIdsRef.current.clear();
  }, []);

  const toast = {
    success: (input) => addToast(input, 'success'),
    error: (input) => addToast(input, 'error'),
    info: (input) => addToast(input, 'info'),
  };

  return { toasts, toast, dismissToast };
}
