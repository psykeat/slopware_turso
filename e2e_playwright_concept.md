# E2E-Testing Konzept & Playwright-Struktur für slopware

Dieses Konzept beschreibt den konkreten Aufbau von End-to-End-Tests (E2E) mit Playwright in Kombination mit Better Auth und unserer mandantenfähigen (Multi-Tenant) Datenbank.

---

## 1. Verzeichnisstruktur für Playwright

Wir platzieren die Testdateien direkt im `apps/web/` Projekt, da es unsere Benutzeroberfläche hostet:

```
apps/web/
├── playwright.config.ts          # Globale Playwright-Konfiguration
├── e2e/
│   ├── setup/
│   │   ├── auth.setup.ts         # Login & Generierung von storageState
│   │   └── seed.ts               # Datenbank-Seeding für Test-Tenants (Alpha & Beta)
│   ├── specs/
│   │   ├── admin/
│   │   ├── tenant-isolation/
│   │   │   └── data-leak.spec.ts # Testet, dass Tenant Beta keine Daten von Tenant Alpha sieht
│   │   └── documents/
│   │       └── editor.spec.ts    # Testet das Anlegen/Bearbeiten von Dokumenten
│   └── .auth/
│       ├── tenant-alpha.json     # Gespeicherte Session-Cookies für Tenant Alpha
│       └── tenant-beta.json      # Gespeicherte Session-Cookies für Tenant Beta
```

---

## 2. Global Setup: `e2e/setup/auth.setup.ts`

Dieser Setup-Test läuft vor allen anderen Specs. Er erzeugt authentifizierte Sessions direkt über die Better Auth API (ohne UI) und speichert den Session-Zustand für beide Test-Tenants.

```typescript
// apps/web/e2e/setup/auth.setup.ts
import { test as setup } from "@playwright/test";
import { createAuthClient } from "@better-auth/client"; // Oder direkter HTTP API-Call

// Wir definieren zwei separate Rollen/Tenants
const tenants = [
  {
    name: "tenant-alpha",
    email: "alpha-admin@slopware.test",
    password: "password123",
    storagePath: "e2e/.auth/tenant-alpha.json",
  },
  {
    name: "tenant-beta",
    email: "beta-user@slopware.test",
    password: "password123",
    storagePath: "e2e/.auth/tenant-beta.json",
  },
];

for (const tenant of tenants) {
  setup(`Authenticate ${tenant.name}`, async ({ request, context }) => {
    // 1. Better Auth Session per API Request anfordern
    const response = await request.post("http://localhost:3000/api/auth/sign-in", {
      data: {
        email: tenant.email,
        password: tenant.password,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to authenticate ${tenant.name}: ${response.statusText()}`);
    }

    // 2. Zustand (inkl. Cookies von localhost) persistieren
    await context.storageState({ path: tenant.storagePath });
  });
}
```

---

## 3. Playwright Konfiguration: `playwright.config.ts`

Hier definieren wir die Abhängigkeit: Alle normalen Tests hängen vom erfolgreichen Auth-Setup ab und laden die entsprechende Rolle.

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Setup-Project zuerst ausführen
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Tests für Tenant Alpha (Eingeloggt als Alpha Admin)
    {
      name: "tenant-alpha-tests",
      testMatch: /specs\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/tenant-alpha.json",
      },
    },
  ],
});
```

---

## 4. Beispiel-Test für Dokumente: `e2e/specs/documents/editor.spec.ts`

Da dieser Test im Projekt `tenant-alpha-tests` läuft, startet Playwright den Browser **bereits vollständig authentifiziert**. Der Test kann direkt den Belegeditor aufrufen.

```typescript
// apps/web/e2e/specs/documents/editor.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Beleg-Editor (DocumentEditor)", () => {
  test.beforeEach(async ({ page }) => {
    // Direkt in den geschützten Bereich navigieren
    await page.goto("/app/documents");
  });

  test("sollte einen neuen Beleg anlegen und Zeilen hinzufügen können", async ({ page }) => {
    // 1. Klicke auf "Neuer Beleg"
    await page.click("#action-new-document"); // Eindeutige ID aus unserem UI-Konzept

    // 2. Warte auf den Belegeditor
    await expect(page.locator("#document-editor")).toBeVisible();

    // 3. Empfänger-Adresse auswählen (AutoComplete/Select)
    await page.fill("#document-customer-search", "Muster GmbH");
    await page.keyboard.press("Enter");

    // 4. Position hinzufügen
    await page.click("#add-line-item");
    await page.fill("#line-item-0-article", "ART-1000"); // Seeded Artikel
    await page.keyboard.press("Enter");
    await page.fill("#line-item-0-qty", "5");

    // 5. Beleg mit F10 (Hotkey) speichern
    await page.keyboard.press("F10");

    // 6. Validieren, dass der Beleg in der Liste existiert
    await expect(page.locator(".toast-success")).toBeVisible();
    await page.goto("/app/documents");
    await expect(page.locator("text=Muster GmbH")).toBeVisible();
  });
});
```

---

## 5. Tenancy / Isolationstest: `e2e/specs/tenant-isolation/data-leak.spec.ts`

Dieser Test stellt sicher, dass Mandant Alpha niemals auf Daten von Mandant Beta zugreifen kann. Dafür authentifizieren wir uns programmatisch als Tenant Beta und versuchen, eine bekannte ID von Tenant Alpha aufzurufen.

```typescript
// apps/web/e2e/specs/tenant-isolation/data-leak.spec.ts
import { test, expect } from "@playwright/test";

// Dieser Test überschreibt den storageState manuell für diesen Testblock auf "Beta"
test.use({ storageState: "e2e/.auth/tenant-beta.json" });

test("Mandant Beta darf Belege von Mandant Alpha nicht abrufen können", async ({ request }) => {
  // Eine bekannte Beleg-ID, die zu Tenant Alpha gehört (z.B. aus Seed-Daten)
  const alphaDocumentId = "019e2889-5cd7-714b-9922-000000000001";

  // Versuch, die Daten direkt über die API als Tenant Beta abzurufen
  const response = await request.get(`/api/data/document/${alphaDocumentId}`);

  // Der Server muss den Zugriff verweigern (404 Not Found oder 403 Forbidden)
  expect(response.status()).toBe(404);
});
```
