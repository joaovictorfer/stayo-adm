import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  Book,
  Building,
  Building2,
  Calendar,
  ChartBar,
  ClipboardList,
  Cog,
  DollarSign,
  FileText,
  Files,
  LayoutDashboard,
  List,
  Menu,
  MessageCircle,
  Plug,
  Home,
  Search,
  Server,
  Settings,
  ShoppingBag,
  SquareCheck,
  Star,
  UserCheck,
  Users,
  X,
  ChevronDown,
  LogOut,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { cn } from "@/lib/utils";
import { navigation, navigationGroups, type NavItem } from "../../config/navigation";
import { isSupabaseConfigured } from "../../lib/api/supabase-client";
import { signOut, useAuthSession } from "../../lib/auth/session";

const icons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  building: Building,
  "building-community": Building2,
  calendar: Calendar,
  users: Users,
  "clipboard-list": ClipboardList,
  list: List,
  template: Files,
  "file-invoice": FileText,
  checklist: SquareCheck,
  "settings-automation": Cog,
  "message-circle": MessageCircle,
  "user-star": Star,
  "user-check": UserCheck,
  "file-text": FileText,
  book: Book,
  "shopping-bag": ShoppingBag,
  "currency-dollar": DollarSign,
  "chart-bar": ChartBar,
  settings: Settings,
  "server-2": Server,
  plug: Plug,
  home: Home,
};

/** `to` vem de dados de configuração, então usamos o Link com tipagem solta. */
const NavLink = Link as unknown as ComponentType<{
  to: string;
  className?: string;
  onClick?: (() => void) | undefined;
  children?: ReactNode;
}>;

function Icon({ name }: { name: string }) {
  const Cmp = icons[name] ?? List;
  return <Cmp size={18} className="shrink-0" />;
}

function isActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
}

function currentSection(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  const visit = (items: NavItem[]) => {
    for (const item of items) {
      if (isActive(pathname, item.path)) {
        if (!best || item.path.length > best.path.length) best = item;
      }
      if (item.children) visit(item.children);
    }
  };
  visit(navigation);
  return best;
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navigation.filter((i) => i.children).map((i) => [i.id, isActive(pathname, i.path)] as const),
    ),
  );

  return (
    <nav className="admin-sidebar-nav flex flex-col gap-5 px-3 py-4 text-sm" aria-label="Navegação principal">
      {navigationGroups.map((group) => {
        const groupItems = group.itemIds
          .map((id) => navigation.find((item) => item.id === id))
          .filter((item): item is NavItem => Boolean(item));
        return (
          <div key={group.id} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-sidebar-muted)]/70">
              {group.label}
            </p>
            {groupItems.map((item) => {
              const active = isActive(pathname, item.path);
              if (!item.children) {
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[var(--admin-radius)] px-3 py-2 text-[13px] text-[var(--admin-sidebar-muted)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-text)]",
                      active &&
                        "bg-[var(--admin-sidebar-active)] text-[var(--admin-sidebar-text)] shadow-sm",
                    )}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              }
              const expanded = open[item.id] ?? active;
              return (
                <div key={item.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-expanded={expanded}
                    aria-controls={`admin-submenu-${item.id}`}
                    onClick={() => setOpen((s) => ({ ...s, [item.id]: !expanded }))}
                    className={cn(
                      "h-auto w-full justify-start gap-2.5 rounded-[var(--admin-radius)] px-3 py-2 text-[13px] font-normal text-[var(--admin-sidebar-muted)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-text)]",
                      active && "text-[var(--admin-sidebar-text)]",
                    )}
                  >
                    <Icon name={item.icon} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      className={cn("transition-transform", expanded && "rotate-180")}
                    />
                  </Button>
                  <div id={`admin-submenu-${item.id}`} className="admin-submenu" data-expanded={expanded} inert={!expanded} aria-hidden={!expanded}>
                    <div className="admin-submenu-inner">
                    <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l border-[var(--admin-sidebar-hover)] pl-2">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.id}
                          to={child.path}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2.5 rounded-[var(--admin-radius)] px-3 py-1.5 text-xs text-[var(--admin-sidebar-muted)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-text)]",
                            pathname === child.path &&
                              "bg-[var(--admin-sidebar-active)] text-[var(--admin-sidebar-text)]",
                          )}
                        >
                          <Icon name={child.icon} />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawer, setDrawer] = useState(false);
  const section = currentSection(pathname);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  return (
    <div className="stayo-admin-theme min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)] lg:flex">
      <aside className="hidden w-64 shrink-0 bg-[var(--admin-sidebar)] text-[var(--admin-sidebar-text)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav pathname={pathname} />
        </div>
        <SidebarAccount />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="admin-menu-backdrop absolute inset-0 bg-[color-mix(in_srgb,var(--admin-sidebar-strong)_60%,transparent)] backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <div className="admin-menu-panel absolute left-0 top-0 flex h-full w-[min(18rem,88vw)] flex-col bg-[var(--admin-sidebar)] text-[var(--admin-sidebar-text)] shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDrawer(false)}
                className="mr-3 text-[var(--admin-sidebar-muted)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-text)]"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav pathname={pathname} onNavigate={() => setDrawer(false)} />
            </div>
            <SidebarAccount />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_94%,transparent)] px-4 backdrop-blur-xl lg:px-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDrawer(true)}
            className="text-[var(--admin-muted)] lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </Button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-sm">
            <Home size={14} className="mr-2 hidden shrink-0 text-[var(--admin-accent)] sm:block" />
            <span className="hidden text-[var(--admin-muted)] sm:inline">Visão geral</span>
            {section && (
              <>
                <span className="mx-2 hidden text-[var(--admin-border)] sm:inline">/</span>
                <span className="truncate font-medium text-[var(--admin-text)]">{section.label}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label className="admin-header-search hidden items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-1.5 text-sm md:flex">
              <Search size={15} className="text-[var(--admin-muted)]" />
              <input
                type="search"
                placeholder="Buscar imóvel, reserva, módulo..."
                className="w-44 bg-transparent text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-muted)] lg:w-56"
              />
              <kbd className="rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] text-[var(--admin-muted)]">
                ⌘K
              </kbd>
            </label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Notificações"
              className="border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-muted)] shadow-none"
            >
              <Bell size={16} />
            </Button>
            <AccountMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-5 xl:p-6"><div key={pathname} className="admin-page-enter min-w-0">{children}</div></main>
      </div>
    </div>
  );
}

const adminRoleLabels: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  commercial: "Comercial",
  operations: "Operações",
  finance: "Financeiro",
  viewer: "Leitura",
};

/** Só aparece quando o Supabase (auth real) está configurado — sem isso, não há sessão para encerrar. */
function AccountMenu() {
  const auth = useAuthSession();

  if (!isSupabaseConfigured() || auth.status !== "authenticated") return null;

  const name = auth.profile?.fullName ?? auth.session?.user.email ?? "Usuário";
  const role = auth.profile
    ? (adminRoleLabels[auth.profile.role] ?? auth.profile.role)
    : "Conta Stayo";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--admin-info-soft)] text-[11px] font-semibold text-[var(--admin-primary)]">
        {initials || <UserRound size={15} />}
      </span>
      <span className="hidden min-w-0 lg:block">
        <strong className="block max-w-40 truncate text-xs font-semibold text-[var(--admin-text)]">
          {name}
        </strong>
        <small className="block text-[10px] text-[var(--admin-muted)]">{role}</small>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void signOut()}
        aria-label="Sair"
        className="text-[var(--admin-muted)]"
      >
        <LogOut size={16} />
      </Button>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex min-h-24 flex-col items-start justify-center border-b border-[var(--admin-sidebar-hover)] px-4 py-3">
      <StayoLogo variant="white" className="h-auto w-28" />
      <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-sidebar-muted)]">
        Centro de Controle
      </span>
    </div>
  );
}

function SidebarAccount() {
  const auth = useAuthSession();
  const name =
    auth.status === "authenticated"
      ? (auth.profile?.fullName ?? auth.session?.user.email ?? "Equipe Stayo")
      : "Equipe Stayo";
  const role =
    auth.status === "authenticated" && auth.profile
      ? (adminRoleLabels[auth.profile.role] ?? auth.profile.role)
      : "Admin";
  const initials = useMemo(
    () =>
      name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    [name],
  );
  return (
    <div className="border-t border-[var(--admin-sidebar-hover)] p-3">
      <div className="flex items-center gap-3 rounded-[var(--admin-radius)] px-2 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--admin-sidebar-hover)] text-xs font-semibold text-[var(--admin-sidebar-text)]">
          {initials || <UserRound size={16} />}
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-xs font-semibold text-[var(--admin-sidebar-text)]">
            {name}
          </strong>
          <small className="block text-[10px] text-[var(--admin-sidebar-muted)]">{role}</small>
        </span>
      </div>
    </div>
  );
}
