import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void } };
type ShowToast = (message: string, action?: Toast["action"]) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** One toast at a time, sitting just above the tab bar. Used for "Basil watered — Undo" confirmations. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<ShowToast>((message, action) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, action });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 6000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto max-w-md md:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-[var(--radius-xl)] bg-foreground py-1.5 pl-4 pr-1.5 text-background animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
                className="h-11 rounded-[var(--radius)] px-4 font-bold text-[#a9c7f2] dark:text-[#2c5da8]"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
