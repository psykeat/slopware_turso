# Article Images Feature (1:N) & Secure Storage

This document outlines the finalized technical details and architecture of the Article Images and secure storage implementation.

Status: **Completed and Verified**

---

## 1. Database Schema (`packages/db/src/schema/app.schema.ts`)

The database is configured to support a 1:N relationship between articles and images, along with layout and document-rendering options.

### `articleImage` Table

```ts
export const articleImage = pgTable(
  "article_image",
  {
    articleImageId: uuid("article_image_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("article_image_tenant_id_image_id_key").on(table.tenantId, table.articleImageId),
    index("idx_article_image_tenant_article").on(table.tenantId, table.articleId),
    index("idx_article_image_tenant_archived").on(table.tenantId, table.archived),
  ],
);
```

### Table Column Additions

- **`article` Table**: Prepended a plain `primaryImageId: uuid("primary_image_id")` field (decoupled UUID column to avoid cyclic Drizzle schema compile issues).
- **`company` Table**: Appended two layout options to control displaying images:
  - `showArticleImageInEntry: boolean("show_article_image_in_entry").notNull().default(false)`
  - `showArticleImageOnDocuments: boolean("show_article_image_on_documents").notNull().default(false)`

---

## 2. Secure Local File Storage & Streaming APIs

To respect the invariant **"Tenant isolation is server-side only"**, uploaded binaries are saved outside of the web public root and streamed through a secure, authenticated controller.

### Folder Structure

Files are stored securely under:
`storage/tenant-{tenantId}/articles/{articleId}/{uuid}-{fileName}`

### Route Handlers

#### Upload & List Endpoint: `POST | GET` `/api/articles/$articleId/images`

- **Path**: `apps/web/src/routes/api/articles/$articleId/images.ts`
- **GET**: Verifies session and active tenant, returning all non-archived `articleImage` rows sorted by `sortOrder: asc`.
- **POST**: Expects `multipart/form-data`. Saves the binary payload to disk, inserts the metadata record with an incremented `sortOrder` in a transaction, and atomically assigns the article's `primaryImageId` if no primary image exists yet.

#### File Stream Endpoint: `GET` `/api/storage/article-images/$imageId`

- **Path**: `apps/web/src/routes/api/storage/article-images/$imageId.ts`
- **GET**: Queries the image by `imageId`. Enforces that the logged-in session's tenant ID matches the file record's `tenantId` before reading from disk and returning a streamed response with the matching `Content-Type`. If the tenant mismatches or the file is missing, returns a secure `403` or `404` error.

---

## 3. UI Integrations

The user experience is highly visual and fits seamlessly into the platform's metadata-first design patterns.

### Image Management Tab Component (`ArticleImagesTab.tsx`)

- **Path**: `packages/ui/components/article-images-tab.tsx`
- **Features**:
  - Spacious card gallery grid displaying all uploaded images.
  - Prominent star badging to identify the current active **Primary** image.
  - Drag-and-drop file upload zone with visual progress and loading spinner states.
  - Action overlays:
    - **Set Primary**: Updates the article's `primaryImageId` reference via PATCH.
    - **Reorder**: Safely swaps `sortOrder` values between adjacent cards to shift card priority left or right.
    - **Delete**: Soft deletes the image in the DB (PATCH `archived = true`). If the deleted image was the primary image, it safely nulls `article.primaryImageId`.

### Article Grid & TriView workspace integration (`articles.tsx`)

- **Path**: `apps/web/src/routes/_auth/app/articles.tsx`
- **Modifications**:
  - Appended the **"Bilder"** tab as the second option in the dependent pane (alongside _Details_, _Langtexte_, etc.), loaded dynamically with full upload support when an article is active.
  - Prepeded a visual thumbnail column in the main Articles list DataGrid, displaying a `32x32`px thumbnail preview of `primaryImageId` (with lazy loading and a fallback `ImageIcon` placeholder when empty).

### Document Lines Grid preview (`document-editor.tsx`)

- **Path**: `packages/ui/components/document-editor.tsx`
- **Modifications**:
  - Propagated the `companyId` prop into `DocumentLinesEditor` from the parent `DocumentEditor`.
  - Queried the active company configurations (`showArticleImageInEntry`) on grid initialization.
  - If `showArticleImageInEntry` is enabled and `articleMeta.primaryImageId` is present, prepends a smooth `24x24`px image thumbnail next to the article search lookup in the row layout in both editing and read-only states. Has zero impact on the column template structure, avoiding any grid shifts.

### Company Settings & Localization

- The newly added company layout options `showArticleImageInEntry` and `showArticleImageOnDocuments` are automatically introspected by the dynamic `EntityMask` settings screen.
- They are fully localized using custom metadata annotations in the `schema_annotations` database table, displaying with friendly, localized labels and description helper texts:
  - **`showArticleImageInEntry`**: _"Artikelbilder in Erfassung anzeigen"_ (Displays article thumbnails in the document lines fast-entry grid).
  - **`showArticleImageOnDocuments`**: _"Artikelbilder auf Belegen anzeigen"_ (Displays article thumbnails in printed PDF documents).

### Document PDF Print Layout (`print.tsx` & `document-pdf.tsx`)

- **Print API Route (`apps/web/src/routes/api/documents/$documentId/print.tsx`)**:
  - Performs a `leftJoin` with the `article` table in the document line query to retrieve each line item's `primaryImageId`.
  - Securely reads the associated image file binaries from the local server directory, encoding them as Base64 data-URLs. This bypasses HTTP lookup overhead or localhost port resolution issues inside the PDF renderer.
  - Passes the Base64 image payloads and the `showArticleImageOnDocuments` company setting down to the PDF compiler.
- **PDF Layout Component (`apps/web/src/pdf/document-pdf.tsx`)**:
  - Extended type interfaces for `DocumentLine` and `CompanyForPrint`.
  - Uses the `@react-pdf/renderer` `<Image>` component to render a neat, styled `24x24`px article preview next to the description text inside the printed layout whenever the option is enabled and a primary image is present.
