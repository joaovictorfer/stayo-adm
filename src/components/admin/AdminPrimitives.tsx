import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, ArrowRight, Inbox, Search } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ eyebrow, title, description, meta, actions }: { eyebrow?: string; title: string; description?: string; meta?: ReactNode; actions?: ReactNode }) {
  return <header className="admin-page-header"><div className="min-w-0">{eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h1>{title}</h1>{meta && <div className="admin-page-meta">{meta}</div>}</div>{description && <p className="admin-page-description">{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</header>;
}

export function AdminSection({ title, description, action, children, className }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("admin-section", className)}>{(title || description || action) && <div className="admin-section-heading"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{action}</div>}{children}</section>;
}

export type AdminTone = "neutral" | "info" | "success" | "warning" | "danger";
export function AdminStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: AdminTone }) { return <span className={cn("admin-status-badge", `is-${tone}`)}>{children}</span>; }

export function AdminStatCard({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: ComponentType<{ className?: string }>; label: string; value: ReactNode; detail?: ReactNode; tone?: AdminTone }) {
  return <div className={cn("admin-stat-card", `is-${tone}`)}><div className="admin-stat-topline"><span>{label}</span><span className="admin-stat-icon"><Icon aria-hidden="true" /></span></div><strong>{value}</strong>{detail && <p>{detail}</p>}</div>;
}

export function AdminAttentionCard({ title, description, meta, action, tone = "warning" }: { title: string; description: string; meta?: ReactNode; action?: ReactNode; tone?: AdminTone }) {
  return <div className={cn("admin-attention-card", `is-${tone}`)}><span className="admin-attention-icon"><AlertTriangle aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3>{title}</h3>{meta}</div><p>{description}</p></div>{action && <div className="admin-attention-action">{action}</div>}</div>;
}

export function AdminToolbar({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("admin-toolbar", className)}>{children}</div>; }
export function AdminFilterBar({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("admin-filter-bar", className)}>{children}</div>; }
export function AdminDataList({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("admin-data-list", className)}>{children}</div>; }
export function AdminDataRow({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn("admin-data-row", className)}>{children}</div>; }

export function AdminEmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return <div className="admin-empty-state"><span className="admin-empty-icon"><Icon aria-hidden="true" /></span><div><h3>{title}</h3>{description && <p>{description}</p>}{action && <div className="mt-4">{action}</div>}</div></div>;
}

export function AdminActionButton({ className, ...props }: ButtonProps) { return <Button className={cn("admin-action-button", className)} {...props} />; }

export function AdminSearchField({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return <label className={cn("admin-search-field", className)}><Search aria-hidden="true" /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function AdminInlineLink({ children }: { children: ReactNode }) { return <span className="admin-inline-link">{children}<ArrowRight aria-hidden="true" /></span>; }
