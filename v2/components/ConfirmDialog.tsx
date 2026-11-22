import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete Sound',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="w-full max-w-md rounded-xl border border-[#475569] bg-[#1B2336] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/15 text-[#EF4444]">
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
            <h2
              id="confirm-dialog-title"
              className="font-display text-base font-semibold text-[#F8FAFC]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#94A3B8] transition-colors duration-150 hover:bg-[#272F42] hover:text-[#F8FAFC]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p id="confirm-dialog-desc" className="mt-3 text-sm leading-relaxed text-[#CBD5E1]">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="min-h-10 cursor-pointer rounded-lg border border-[#475569] bg-[#272F42] px-4 py-2 text-sm font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#64748B] hover:bg-[#334155]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-10 cursor-pointer rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
