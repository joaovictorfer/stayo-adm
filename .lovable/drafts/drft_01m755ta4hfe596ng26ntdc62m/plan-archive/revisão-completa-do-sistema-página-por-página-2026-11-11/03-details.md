## Detalhes técnicos
- Crawl Playwright autenticado (sessão do draft) em todas as rotas de `src/routes`, viewports 1280 e 390; captura console, pageerror, HTTP ≥400, tempo até networkidle e screenshot por rota.
- Rotas `$id`/`$token` testadas com ids/tokens reais do banco do draft.
- Varreduras estáticas: casts, `catch {}` vazios, fetch em `useEffect` (11 rotas), cores hardcoded, `head()` ausente, strings em inglês.
- `security--run_security_scan` + deep scan.
- Relatório final em `/mnt/documents/revisao-stayo-admin.md`; correções só após aprovação.
