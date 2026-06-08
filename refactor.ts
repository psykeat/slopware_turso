import fs from 'fs';

const path = 'packages/db/src/services/document-service.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Rename documentLine.articleId to documentLine.variantId
code = code.replace(/documentLine\.articleId/g, 'documentLine.variantId');

// 2. Types and interfaces
code = code.replace(/articleId: string \| null;/g, 'variantId: string | null;');
code = code.replace(/articleId\?: string \| null;/g, 'variantId?: string | null;');
code = code.replace(/articleId: string,/g, 'variantId: string,');

// 3. Destructuring and mapping
code = code.replace(/articleId: line\.articleId/g, 'variantId: line.variantId');
code = code.replace(/articleId: row\.articleId/g, 'variantId: row.variantId');
code = code.replace(/articleId: l\.articleId/g, 'variantId: l.variantId');
code = code.replace(/articleId: data\.articleId/g, 'variantId: data.variantId');
code = code.replace(/articleId: movement\.articleId/g, 'variantId: movement.variantId');

code = code.replace(/line\.articleId/g, 'line.variantId');
code = code.replace(/baseLine\.articleId/g, 'baseLine.variantId');
code = code.replace(/movement\.articleId/g, 'movement.variantId');

code = code.replace(/const articleIds = \[\n\s+\.\.\.new Set\(lines\.map\(\(line\) => line\.variantId\)\.filter\(\(id\): id is string => !!id\)\),\n\s+\];/g, 
`const variantIds = [
        ...new Set(lines.map((line) => line.variantId).filter((id): id is string => !!id)),
      ];`);

// Fix resolveArticlePricing
code = code.replace(/resolveArticlePricing/g, 'resolveVariantPricing');

code = code.replace(`  async resolveVariantPricing(
    variantId: string,
    customerId: string | null,
    documentDate: string,
    tenantId: string,
  ): Promise<{ unitPrice: string; taxCodeId: string | null }> {
    const [art] = await db
      .select()
      .from(article)
      .where(and(eq(article.variantId, variantId), eq(article.tenantId, tenantId)))
      .limit(1);

    if (!art) throw new Error("Article not found");

    if (customerId) {
      const activeLists = await db
        .select({ priceListId: priceList.priceListId })
        .from(priceList)
        .where(and(eq(priceList.tenantId, tenantId), eq(priceList.archived, false)));

      if (activeLists.length > 0) {
        const priceListIds = activeLists.map((p) => p.priceListId);
        const [item] = await db
          .select()
          .from(priceListItem)
          .where(
            and(
              eq(priceListItem.tenantId, tenantId),
              eq(priceListItem.variantId, variantId),
              inArray(priceListItem.priceListId, priceListIds),
            ),
          )
          .limit(1);

        if (item) {
          return { unitPrice: item.price, taxCodeId: art.taxClassId ?? null };
        }
      }
    }

    return { unitPrice: "0", taxCodeId: art.taxClassId ?? null };
  }`, `  async resolveVariantPricing(
    variantId: string,
    customerId: string | null,
    documentDate: string,
    tenantId: string,
  ): Promise<{ unitPrice: string; taxCodeId: string | null }> {
    const [variant] = await db
      .select({
        price: articleVariant.price,
        taxClassId: article.taxClassId,
      })
      .from(articleVariant)
      .innerJoin(article, eq(article.articleId, articleVariant.articleId))
      .where(and(eq(articleVariant.variantId, variantId), eq(articleVariant.tenantId, tenantId)))
      .limit(1);

    if (!variant) throw new Error("Variant not found");

    return { unitPrice: variant.price || "0", taxCodeId: variant.taxClassId ?? null };
  }`);

// Fix applyDeltaEffect
const oldDeltaEffect = `      await tx
        .insert(inventoryBalance)
        .values({
          tenantId,
          companyId: doc.companyId,
          warehouseId,
          variantId: line.variantId,
          onHandQty: String(effectiveQty),
          reservedQty: "0",
          availableQty: String(effectiveQty),
        })
        .onConflictDoUpdate({
          target: [
            inventoryBalance.tenantId,
            inventoryBalance.warehouseId,
            inventoryBalance.variantId,
          ],
          set: {
            onHandQty: sql\`\${inventoryBalance.onHandQty} + \${effectiveQty}\`,
            availableQty: sql\`\${inventoryBalance.onHandQty} + \${effectiveQty} - \${inventoryBalance.reservedQty}\`,
          },
        });

      await tx.insert(inventoryMovement).values({
        tenantId,
        companyId: doc.companyId,
        warehouseId,
        variantId: line.variantId,
        movementType,
        qtyDelta: String(effectiveQty),
        movementDate: now,
        sourceDocumentId: doc.documentId,
        sourceDocumentLineId: documentLineId,
        referenceText: \`delta:\${doc.documentNo}\`,
      });`;

const newDeltaEffect = `      const [invItem] = await tx
        .select()
        .from(inventoryItem)
        .where(and(eq(inventoryItem.variantId, line.variantId), eq(inventoryItem.tenantId, tenantId)))
        .limit(1);

      if (!invItem) throw new Error("Inventory item not found for variant");

      await tx
        .insert(inventoryLevel)
        .values({
          tenantId,
          itemId: invItem.itemId,
          locationId: warehouseId,
          quantity: String(effectiveQty),
        })
        .onConflictDoUpdate({
          target: [inventoryLevel.itemId, inventoryLevel.locationId],
          set: {
            quantity: sql\`\${inventoryLevel.quantity} + \${effectiveQty}\`,
            updatedAt: new Date(),
          },
        });

      await tx.insert(inventoryMovement).values({
        tenantId,
        companyId: doc.companyId,
        warehouseId,
        inventoryItemId: invItem.itemId,
        variantId: line.variantId,
        movementType,
        qtyDelta: String(effectiveQty),
        movementDate: now,
        sourceDocumentId: doc.documentId,
        sourceDocumentLineId: documentLineId,
        referenceText: \`delta:\${doc.documentNo}\`,
      });`;

code = code.replace(oldDeltaEffect, newDeltaEffect);

fs.writeFileSync(path, code);
