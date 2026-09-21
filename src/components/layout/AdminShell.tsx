import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Gauge,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Plug,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  UserCheck,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";

import logoAsset from "../../assets/stayo-logo-clara.png.asset.json";
import { navigation, type NavItem } from "../../config/navigation";
import { isSupabaseConfigured } from "../../lib/api/supabase-client";
import { signOut, useAuthSession } from "../../lib/auth/session";

const icons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  "layout-dashboard": Gauge,
  building: House,
  "building-community": Building2,
  calendar: CalendarDays,
  users: Users,
  "clipboard-list": ClipboardCheck,
  list: ClipboardCheck,
  template: Sparkles,
  "file-invoice": FileText,
  checklist: ClipboardCheck,
  "settings-automation": Wrench,
  "message-circle": MessageCircle,
  "user-star": Users,
  "user-check": UserCheck,
  "file-text": FileText,
  book: BookOpen,
  "shopping-bag": ShoppingBag,
  "currency-dollar": WalletCards,
  "chart-bar": ChartNoAxesCombined,
  settings: Settings,
  "server-2": Settings,
  plug: Plug,
};

type NavGroup = { label: string; ids: string[] };
const groups: NavGroup[] = [
  { label: "Visão geral", ids: ["dashboard"] },
  { label: "Portfólio", ids: ["properties", "owners", "condominiums"] },
  { label: "Implantação", ids: ["implementation"] },
  {
    label: "Operação",
    ids: ["operations", "reservations", "guests", "inspections", "providers", "messages"],
  },
  { label: "Gestão", ids: ["contracts", "financial", "bi"] },
  { label: "Ecossistema", ids: ["guide", "products"] },
  { label: "Sistema", ids: ["settings"] },
];

const NavLink = Link as unknown as ComponentType<{
  to: string;
  className?: string;
  onClick?: (() => void) | undefined;
  children?: ReactNode;
}>;

function isActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function currentSection(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  const visit = (items: NavItem[]) => items.forEach((item) => {
    if (isActive(pathname, item.path) && (!best || item.path.length > best.path.length)) best = item;
    if (item.children) visit(item.children);
  });
  visit(navigation);
  return best;
}

function NavIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? ClipboardCheck;
  return <Icon size={17} className="shrink-0" />;
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navigation.filter((item) => item.children).map((item) => [item.id, true])),
  );
  const byId = new Map(navigation.map((item) => [item.id, item]));

  return (
    <nav className="flex flex-col gap-5 px-3 pb-6" aria-label="Navegação principal">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase text-sidebar-foreground/45">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.ids.map((id) => {
              const item = byId.get(id);
              if (!item) return null;
              const active = isActive(pathname, item.path);
              const expanded = open[item.id] ?? active;
              if (!item.children) {
                return (
                  <NavLink key={item.id} to={item.path} onClick={onNavigate}
                    className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium ${active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                    <NavIcon name={item.icon} /><span className="truncate">{item.label}</span>
                  </NavLink>
                );
              }
              return (
                <div key={item.id}>
                  <button type="button" onClick={() => setOpen((state) => ({ ...state, [item.id]: !expanded }))}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium ${active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                    <NavIcon name={item.icon} /><span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                    {item.children.map((child) => {
                      const childActive = pathname === child.path;
                      return <NavLink key={child.id} to={child.path} onClick={onNavigate}
                        className={`flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-xs ${childActive ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground" : "text-sidebar-foreground/62 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                        <NavIcon name={child.icon} /><span className="truncate">{child.label}</span>
                      </NavLink>;
                    })}
                  </div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return <div className="border-b border-sidebar-border px-5 py-5">
    <img src={logoAsset.url} alt="Stayo Gramado" className="h-auto w-28 object-contain" />
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase text-sidebar-foreground/50">Centro de controle</span>
      <span className="rounded bg-premium/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-premium">Admin</span>
    </div>
  </div>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [drawer, setDrawer] = useState(false);
  const section = currentSection(pathname);
  useEffect(() => setDrawer(false), [pathname]);

  return <div className="stayo-admin-theme min-h-screen bg-background text-foreground lg:flex">
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen">
      <Brand /><div className="flex-1 overflow-y-auto pt-5"><SidebarNav pathname={pathname} /></div><AccountBlock />
    </aside>

    {drawer && <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
      <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
      <aside className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] max-w-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start"><Brand /><button type="button" onClick={() => setDrawer(false)} aria-label="Fechar menu" className="mr-3 mt-4 rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent"><X size={19} /></button></div>
        <div className="flex-1 overflow-y-auto pt-5"><SidebarNav pathname={pathname} onNavigate={() => setDrawer(false)} /></div><AccountBlock />
      </aside>
    </div>}

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card/95 px-4 shadow-[0_1px_0_color-mix(in_oklab,var(--stayo-navy)_3%,transparent)] backdrop-blur-md sm:px-6 lg:px-8">
        <button type="button" onClick={() => setDrawer(true)} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">{section?.label ?? "Stayo Admin"}</p>
          <p className="hidden text-[11px] text-muted-foreground sm:block">Centro de controle operacional</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm shadow-sm lg:flex">
            <Search size={15} className="text-muted-foreground" />
            <input type="search" placeholder="Buscar imóvel, reserva, proprietário..." className="w-64 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" aria-label="Busca global" />
            <kbd className="text-[10px] text-muted-foreground">⌘K</kbd>
          </label>
          <button type="button" aria-label="Notificações" className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"><Bell size={17} /></button>
          <AccountMenu />
        </div>
      </header>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7"><div className="mx-auto w-full max-w-[1480px]">{children}</div></main>
    </div>
  </div>;
}

const roleLabels: Record<string, string> = { super_admin: "Super admin", admin: "Admin", commercial: "Comercial", operations: "Operações", finance: "Financeiro", viewer: "Leitura" };

function accountData() {
  const auth = useAuthSession();
  if (!isSupabaseConfigured() || auth.status !== "authenticated") return null;
  const name = auth.profile?.fullName ?? auth.session?.user.email ?? "Usuário";
  const role = auth.profile ? roleLabels[auth.profile.role] ?? auth.profile.role : "Admin";
  return { name, role, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() };
}

function AccountBlock() {
  const data = accountData();
  if (!data) return null;
  return <div className="border-t border-sidebar-border p-3"><div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-sidebar-accent p-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-premium text-xs font-bold text-sidebar">{data.initials}</span>
    <div className="min-w-0"><p className="truncate text-xs font-semibold">{data.name}</p><p className="truncate text-[10px] text-sidebar-foreground/55">{data.role}</p></div>
    <button type="button" onClick={() => void signOut()} aria-label="Sair" className="rounded-md p-1.5 text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={15} /></button>
  </div></div>;
}

function AccountMenu() {
  const data = accountData();
  if (!data) return null;
  return <div className="hidden items-center gap-2 sm:flex"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-xs font-bold text-primary-foreground">{data.initials}</span><div className="hidden min-w-0 xl:block"><p className="max-w-40 truncate text-xs font-semibold">{data.name}</p><p className="text-[10px] text-muted-foreground">{data.role}</p></div></div>;
}