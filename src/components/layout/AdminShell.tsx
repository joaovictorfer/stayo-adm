import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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
} from "lucide-react";

import { navigation, type NavItem } from "../../config/navigation";
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
};

/** `to` vem de dados de configuração, então usamos o Link com tipagem solta. */
const NavLink = Link as unknown as ComponentType<{
  to: string;
  className?: string;
  style?: React.CSSProperties | undefined;
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

  const itemStyle = (active: boolean) => ({
    color: active ? "#fdfdfb" : "var(--stayo-ink-muted)",
    backgroundColor: active ? "var(--stayo-forest)" : "transparent",
  });

  return (
    <nav
      className="flex flex-col gap-0.5 p-3 text-sm"
      style={{ fontFamily: "var(--stayo-font-ui)" }}
    >
      {navigation.map((item) => {
        const active = isActive(pathname, item.path);
        if (!item.children) {
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 transition-colors"
              style={itemStyle(active)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          );
        }
        const expanded = open[item.id] ?? active;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [item.id]: !expanded }))}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 transition-colors"
              style={itemStyle(active && !expanded)}
            >
              <Icon name={item.icon} />
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown
                size={16}
                className="transition-transform"
                style={{ transform: expanded ? "rotate(180deg)" : "none" }}
              />
            </button>
            {expanded && (
              <div
                className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l pl-2"
                style={{ borderColor: "var(--stayo-border)" }}
              >
                {item.children.map((child) => (
                  <NavLink
                    key={child.id}
                    to={child.path}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-1.5 transition-colors"
                    style={itemStyle(pathname === child.path)}
                  >
                    <Icon name={child.icon} />
                    <span>{child.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
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
    <div
      className="min-h-screen lg:flex"
      style={{
        backgroundColor: "var(--stayo-bg)",
        color: "var(--stayo-ink)",
        fontFamily: "var(--stayo-font-ui)",
      }}
    >
      <aside
        className="hidden w-64 shrink-0 border-r lg:flex lg:flex-col"
        style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
      >
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav pathname={pathname} />
        </div>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(20, 23, 19, 0.5)" }}
            onClick={() => setDrawer(false)}
          />
          <div
            className="absolute left-0 top-0 flex h-full w-72 flex-col border-r"
            style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="mr-3 rounded-[var(--radius-control)] p-2"
                style={{ color: "var(--stayo-ink-muted)" }}
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav pathname={pathname} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
        >
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="rounded-[var(--radius-control)] p-2 lg:hidden"
            style={{ color: "var(--stayo-ink-muted)" }}
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <nav aria-label="Breadcrumb" className="text-sm">
            <span style={{ color: "var(--stayo-ink-muted)" }}>Stayo Admin</span>
            {section && (
              <>
                <span className="mx-2" style={{ color: "var(--stayo-border)" }}>
                  /
                </span>
                <span style={{ color: "var(--stayo-ink)" }}>{section.label}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label
              className="hidden items-center gap-2 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm sm:flex"
              style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-bg)" }}
            >
              <Search size={15} style={{ color: "var(--stayo-ink-muted)" }} />
              <input
                type="search"
                placeholder="Buscar imóvel, reserva, módulo..."
                className="w-48 bg-transparent outline-none placeholder:text-current lg:w-64"
                style={{ color: "var(--stayo-ink)" }}
              />
              <kbd
                className="rounded border px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
              >
                ⌘K
              </kbd>
            </label>
            <button
              type="button"
              aria-label="Notificações"
              className="rounded-[var(--radius-control)] border p-2"
              style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
            >
              <Bell size={16} />
            </button>
            <AccountMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
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

  const label = auth.profile
    ? `${auth.profile.fullName} · ${adminRoleLabels[auth.profile.role] ?? auth.profile.role}`
    : auth.session?.user.email;

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Sair"
        className="rounded-[var(--radius-control)] border p-2"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

function Brand() {
  return (
    <div
      className="flex items-center gap-2 border-b px-4 py-4"
      style={{ borderColor: "var(--stayo-border)" }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-sm"
        style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
      >
        S
      </span>
      <span
        className="text-base"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Stayo Admin
      </span>
    </div>
  );
}
