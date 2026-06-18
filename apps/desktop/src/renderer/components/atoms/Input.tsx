import { forwardRef } from 'react';
import { cn } from '../../lib/cn.js';

/** Themed text input. Forwards its ref so callers can focus it (the launcher). */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg outline-none transition placeholder:text-subtle focus:border-accent',
          className,
        )}
        {...props}
      />
    );
  },
);
