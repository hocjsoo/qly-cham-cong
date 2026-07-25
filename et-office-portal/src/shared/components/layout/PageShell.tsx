import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, actions, children }: PageShellProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold text-neutral-900">{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  );
}
