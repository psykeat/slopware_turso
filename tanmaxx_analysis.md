# Architektur-Analyse: Was wir von `jherr/tanmaxx-17` lernen können

Wir haben das Repository [jherr/tanmaxx-17](https://github.com/jherr/tanmaxx-17) analysiert und mit unserer Architektur in **`slopware`** verglichen. Beide Projekte nutzen **TanStack Start**, **TanStack Router** und **TanStack Query** in einem Monorepo-Layout, verfolgen jedoch teilweise unterschiedliche Ansätze.

Hier ist eine detaillierte Gegenüberstellung und die wichtigsten Erkenntnisse (Learnings), die wir für unser Projekt mitnehmen können.

---

## 1. Direktvergleich der Tech-Stacks

| Bereich                 | `slopware` (Unser Projekt)                                  | `tanmaxx-17` (Demo Projekt)   | Bewertung / Learning für uns                                                                                                                                           |
| :---------------------- | :---------------------------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework & SSR**     | `@tanstack/react-start`                                     | `@tanstack/react-start`       | Beide nutzen die moderne Fullstack-SSR-Architektur mit Server Functions.                                                                                               |
| **Routing**             | `@tanstack/react-router`                                    | `@tanstack/react-router`      | Beide nutzen dateibasiertes, typsicheres Routing.                                                                                                                      |
| **Server-Queries**      | `@tanstack/react-query`                                     | `@tanstack/react-query`       | Identisch.                                                                                                                                                             |
| **Client-State**        | Custom Context Providers (`ThemeProvider`, `FocusProvider`) | `@tanstack/store`             | **Interessant:** Für flüchtigen Client-Zustand (wie UI-Einstellungen, Timer) bietet `@tanstack/store` eine leichtgewichtige, performante Alternative zu React Context. |
| **Tabellen**            | Hand-rolled / `@tanstack/react-table`                       | `@tanstack/react-table`       | Wir nutzen dies bereits in `@repo/ui` (`DataGrid`).                                                                                                                    |
| **Virtualisierung**     | `@tanstack/react-virtual`                                   | `@tanstack/react-virtual`     | Wird in beiden Systemen für große Datenmengen verwendet (z.B. 5000+ Zeilen).                                                                                           |
| **Formular-Verwaltung** | Standard HTML + Custom Validierung                          | `@tanstack/react-form`        | **Learning:** `@tanstack/react-form` bietet typsichere Validierung und State-Handling direkt integriert.                                                               |
| **Local-first DB**      | Server-side Postgres scoped by Tenant                       | `@tanstack/db` (Experimental) | **Local-First:** `@tanstack/db` erlaubt lokale Client-Datenbanken. Für SaaS (unseren Tenant-Fokus) weniger relevant, aber nützlich für Offline-Funktionalitäten.       |
| **Hotkeys**             | Custom `CommandProvider`                                    | `@tanstack/react-hotkeys`     | **Vergleich:** Unser handgestricktes System ist stark für hierarchische Kontexte. `@tanstack/react-hotkeys` bietet standardisiertere Vim-style Chords.                 |
| **Durable Workflows**   | None / Async Server Tasks                                   | `@tanstack/workflow-core`     | **Workflow Engine:** Langlebige, zustandsbehaftete Abläufe (z.B. AI-Generierung) laufen dort als Workflow ab.                                                          |

---

## 2. Detaillierte Learnings & Potenziale

### 💡 A. Ephemerer State mit `@tanstack/store`

Unser Projekt verwendet React Context in `__root.tsx` (z.B. `FocusProvider`, `CommandProvider`). Das führt bei häufigen Updates zu großflächigen Re-Renders.

- **Vorteil `@tanstack/store`:** Es bietet ultra-granulare Selektoren. Wenn sich beispielsweise nur ein Timer oder ein Regler ändert, re-rendert nur die Komponente, die den spezifischen Wert abonniert hat.
- **Empfehlung:** Falls wir komplexen, globalen Client-State einführen, sollten wir `@tanstack/store` evaluieren.

### 📝 B. Typsichere Formulare mit `@tanstack/react-form`

Unser `EntityMask`-Komponentensystem baut auf klassischen State-Änderungen und Event-Handlern auf.

- **Vorteil `@tanstack/react-form`:** Es erlaubt uns, verschachtelte Zod-Schemas direkt auf Feldebene zu validieren. Es verwaltet den `dirty`- / `touched`-State automatisch und bietet saubere Schnittstellen für asynchrone Formularoperationen.
- **Empfehlung:** Mittelfristig könnten wir `@tanstack/react-form` in `EntityMask` integrieren, um Validierungs-Boilerplate einzusparen.

### ⚡ C. Debouncing mit `@tanstack/react-pacer`

Für Suchfelder (wie die Adress- oder Artikelsuche) verwenden wir meist Standard-Eingabesteuerungen.

- **Vorteil `@tanstack/react-pacer`:** Es vereinfacht das Debouncing von Benutzerinteraktionen direkt im TanStack-Stil und sorgt dafür, dass API-Requests geschont werden.

### 🤖 D. Agent-Integration mit `@tanstack/intent`

`tanmaxx-17` exportiert AI-Agent-Skills über `@tanstack/intent`.

- **Vorteil:** Dies ermöglicht es LLM-basierten Tools (wie Cursor, Claude Code, Antigravity) die Fähigkeiten der App dynamisch zu erfassen und auszuführen.
- **Empfehlung:** Sehr nützlich für automatisierte End-to-End Test- und Wartungsaufgaben in unserem eigenen Agent-Setup.

### 🔄 E. Dauerhafte Server-Workflows mit `@tanstack/workflow-core`

Für asynchrone, mehrstufige Operationen (z.B. LLM-Dokumentenanalyse) ist eine robuste Workflow-Steuerung wichtig.

- **Vorteil `@tanstack/workflow-core`:** Erlaubt zustandsbehaftete, wiederaufnehmbare Ausführungen auf dem Server.
- **Empfehlung:** Wenn wir komplexe Datenpipelines bauen, können wir dies statt einfacher Cronjobs / unstrukturierter Server-Funktionen einsetzen.
