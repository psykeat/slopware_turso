# Shopware 6 Integration

## Umgebung & Setup

- **System:** Lokaler Docker-Container via `dockware/play`
- **URL (Storefront):** http://localhost:8080
- **URL (Admin):** http://localhost:8080/admin
- **Admin Login:** `admin` / `shopware`
- **Docker Service Name:** `shopware` in der Haupt `docker-compose.yml`

## API Zugangsdaten

Um mit der Shopware API (z.B. der Sync API oder Admin API) zu kommunizieren, wurde im
lokalen dockware-Container eine Integration angelegt. Die Zugangsdaten werden **nicht**
mehr aus der `.env` gelesen — sie gehoeren pro Verkaufskanal in die DB-Tabelle
`sales_channel` und werden ueber die Sales-Channel-UI (`/app/settings/sales-channels`)
eingetragen. Der Sync-Service liest ausschliesslich aus dieser Tabelle (`getSalesChannel()`).

Bootstrap-Werte fuer den lokalen Container (zum Eintippen in die UI):

```text
API URL:       http://localhost:8080
Client ID:     SWIAEWDGCE9QSHHMQKL0UUD4RG
Client Secret: dHJ0UXlreXRSOXJuUXc2a3JUT2JYQW9sTFFnaHpGUHRrNVU3eDc
```

## Nächste Schritte

Für die E-Commerce-Integrationsplattform (Slopware) soll nun die Anbindung an Shopware implementiert werden.

- Abrufen eines OAuth2 Bearer-Tokens über `POST /api/oauth/token` (grant_type: `client_credentials`)
- Synchronisation von Produkten und Beständen über die Shopware Sync-API (`POST /api/_action/sync`)
