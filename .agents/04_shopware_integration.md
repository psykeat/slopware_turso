# Shopware 6 Integration

## Umgebung & Setup
- **System:** Lokaler Docker-Container via `dockware/play`
- **URL (Storefront):** http://localhost:8080
- **URL (Admin):** http://localhost:8080/admin
- **Admin Login:** `admin` / `shopware`
- **Docker Service Name:** `shopware` in der Haupt `docker-compose.yml`

## API Zugangsdaten
Um mit der Shopware API (z.B. der Sync API oder Admin API) zu kommunizieren, wurde eine Integration angelegt. 
Die entsprechenden Zugangsdaten sind in der `apps/web/.env` hinterlegt:

```env
SHOPWARE_API_URL="http://localhost:8080"
SHOPWARE_CLIENT_ID="SWIAEWDGCE9QSHHMQKL0UUD4RG"
SHOPWARE_CLIENT_SECRET="dHJ0UXlreXRSOXJuUXc2a3JUT2JYQW9sTFFnaHpGUHRrNVU3eDc"
```

## Nächste Schritte
Für die E-Commerce-Integrationsplattform (Slopware) soll nun die Anbindung an Shopware implementiert werden.
- Abrufen eines OAuth2 Bearer-Tokens über `POST /api/oauth/token` (grant_type: `client_credentials`)
- Synchronisation von Produkten und Beständen über die Shopware Sync-API (`POST /api/_action/sync`)
