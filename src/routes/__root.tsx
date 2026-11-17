import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  type ErrorComponentProps,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AdminShell } from "../components/layout/AdminShell";
import { Toaster } from "../components/ui/sonner";
import { AuthSessionProvider, useAuthSession } from "../lib/auth/session";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stayo Admin" },
      { name: "description", content: "Painel administrativo interno da operação Stayo." },
      { property: "og:title", content: "Stayo Admin" },
      { property: "og:description", content: "Painel administrativo interno da operação Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider><RootContent /></AuthSessionProvider>
    </QueryClientProvider>
  );
}

function RootContent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  /** Rotas /portal/* são páginas públicas (link do proprietário) — sem o shell administrativo. */
  const isPublicPortal = pathname.startsWith("/portal/") || pathname.startsWith("/cobranca/") || pathname.startsWith("/vistoria/prototipo") || pathname.startsWith("/proprietario-prototipo") || pathname.startsWith("/vistoria-implantacao/") || pathname.startsWith("/meu-dia/");
  const isLoginRoute = pathname === "/login";
  const isPublicRoute = isPublicPortal || isLoginRoute;

  const auth = useAuthSession();
  const navigate = useNavigate();

  /**
   * Gate de autenticação (Fase 17) — só ativo quando VITE_SUPABASE_* está
   * configurado (`useAuthSession` resolve para "not_required" sem isso, e
   * o app continua funcionando sem login, como sempre). Nunca é a
   * verdadeira barreira de segurança — isso é sempre RLS no banco; este
   * gate só evita que a UI monte telas internas sem sessão.
   */
  useEffect(() => {
    if (isPublicRoute) return;
    if (auth.status === "unauthenticated") {
      void navigate({ to: "/login" });
    }
  }, [auth.status, isPublicRoute, navigate]);

  if (isPublicRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }

  if (auth.status === "loading" || auth.status === "unauthenticated") {
    return (
      <QueryClientProvider client={queryClient}>
        <div
          className="flex min-h-screen items-center justify-center text-sm"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Carregando...
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AdminShell>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </AdminShell>
    </QueryClientProvider>
  );
}
