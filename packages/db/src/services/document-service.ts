import { db } from "../index";
import {
  document,
  documentLine,
  documentGroup,
  company,
  inventoryBalance,
  inventoryMovement,
  factSalesEvent,
  factPurchaseEvent,
  article,
  priceList,
  priceListItem,
  numberSequence,
} from "../schema/app.schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { resolveFiscalPeriodId } from "./fiscal-period-generator";

export interface TypeNode {
  documentType: string;
  typeLabel: string;
  groups: Array<{
    documentGroupId: string;
    name: string;
    documentType: string;
    groupNumber: number;
  }>;
}

export interface TreeSection {
  direction: string;
  label: string;
  types: TypeNode[];
}

const TYPE_LABELS: Record<string, string> = {
  N: "Angebote", A: "Aufträge", L: "Lieferscheine", R: "Rechnungen", G: "Gutschriften",
  b: "Bestellungen", l: "Wareneingänge", r: "Eingangsrechnungen", g: "Eingangsgutschriften",
  V: "Inventur", U: "Umbuchungen", Z: "Zugänge", E: "Entnahmen",
  q: "Produktionsaufträge", p: "Fertigmeldungen",
};

export const DIRECTION_FROM_TYPE: Record<string, string> = {
  N: "OUTBOUND", A: "OUTBOUND", L: "OUTBOUND", R: "OUTBOUND", G: "OUTBOUND",
  b: "INBOUND", l: "INBOUND", r: "INBOUND", g: "INBOUND",
  V: "ADJUSTMENT", Z: "ADJUSTMENT", E: "ADJUSTMENT", U: "ADJUSTMENT",
  q: "PRODUCTION", p: "PRODUCTION",
};

const TYPE_SEQUENCE: Record<string, number> = {
  N: 1, A: 2, L: 3, R: 4, G: 5,
  b: 1, l: 2, r: 3, g: 4,
  V: 1, Z: 2, E: 3, U: 4,
  q: 1, p: 2,
};

const NEXT_TYPE: Record<string, string | undefined> = {
  N: "A", A: "L", L: "R", R: "G", G: undefined,
  b: "l", l: "r", r: "g", g: undefined,
  V: "Z", Z: "E", E: "U", U: undefined,
  q: "p", p: undefined,
};

const DIRECTION_LABELS: Record<string, string> = {
  OUTBOUND: "Warenausgang",
  INBOUND: "Wareneingang",
  ADJUSTMENT: "Lagerbuchungen",
  PRODUCTION: "Produktion",
};

function directionLabel(direction: string | null | undefined): string {
  return DIRECTION_LABELS[direction ?? ""] ?? "Sonstiges";
}

function generateDocumentNo(prefix: string, nextValue: number, padding: number): string {
  return prefix + String(nextValue).padStart(padding, "0");
}

export class DocumentService {
  async postDocument(
    documentId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; document: unknown }> {
    return await db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
        .limit(1);

      if (!doc) throw new Error("Document not found");
      if (doc.status !== "draft") throw new Error("Document must be in draft status to post");

      const lines = await tx
        .select()
        .from(documentLine)
        .where(and(eq(documentLine.documentId, documentId), eq(documentLine.tenantId, tenantId)));

      const movementType = doc.documentType;
      const now = new Date();
      const txId = crypto.randomUUID();

      for (const line of lines) {
        if (!line.articleId) continue;

        const warehouseId = line.warehouseId ?? doc.warehouseId;

        if (movementType === "N" || movementType === "q" || movementType === "p") {
          continue;
        }

        const qty = Number(line.quantity);

        if (movementType === "U") {
          const sourceWh = doc.warehouseId;
          const targetWh = doc.targetWarehouseId;
          if (!sourceWh || !targetWh) continue;

          await tx
            .insert(inventoryBalance)
            .values({
              tenantId,
              companyId: doc.companyId,
              warehouseId: sourceWh,
              articleId: line.articleId,
              onHandQty: String(-qty),
              reservedQty: "0",
              availableQty: String(-qty),
            })
            .onConflictDoUpdate({
              target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
              set: {
                onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
                availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
              },
            });

          await tx
            .insert(inventoryBalance)
            .values({
              tenantId,
              companyId: doc.companyId,
              warehouseId: targetWh,
              articleId: line.articleId,
              onHandQty: String(qty),
              reservedQty: "0",
              availableQty: String(qty),
            })
            .onConflictDoUpdate({
              target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
              set: {
                onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
                availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
              },
            });

          await tx.insert(inventoryMovement).values({
            tenantId,
            companyId: doc.companyId,
            warehouseId: sourceWh,
            articleId: line.articleId,
            movementType,
            qtyDelta: String(-qty),
            movementDate: now,
            sourceDocumentId: documentId,
            sourceDocumentLineId: line.documentLineId,
            transactionId: txId,
            referenceText: doc.documentNo,
          });

          await tx.insert(inventoryMovement).values({
            tenantId,
            companyId: doc.companyId,
            warehouseId: targetWh,
            articleId: line.articleId,
            movementType,
            qtyDelta: String(qty),
            movementDate: now,
            sourceDocumentId: documentId,
            sourceDocumentLineId: line.documentLineId,
            transactionId: txId,
            referenceText: doc.documentNo,
          });

          continue;
        }

        if (!warehouseId) continue;

        let balanceUpdate: Record<string, unknown> = {};

        if (movementType === "L") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
            reservedQty: sql`${inventoryBalance.reservedQty} - ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - (${inventoryBalance.reservedQty} - ${qty})`,
          };
        } else if (movementType === "A") {
          balanceUpdate = {
            reservedQty: sql`${inventoryBalance.reservedQty} + ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} - (${inventoryBalance.reservedQty} + ${qty})`,
          };
        } else if (movementType === "R") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
          };
        } else if (movementType === "G") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
          };
        } else if (movementType === "b") {
          balanceUpdate = {
            expectedPurchaseQty: sql`${inventoryBalance.expectedPurchaseQty} + ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} - ${inventoryBalance.reservedQty} + (${inventoryBalance.expectedPurchaseQty} + ${qty})`,
          };
        } else if (movementType === "l") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
          };
        } else if (movementType === "r") {
          const unitCost = Number(line.netPrice ?? 0);
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
            gldPurchase: sql`CASE WHEN (${inventoryBalance.onHandQty} + ${qty}) = 0 THEN 0
              ELSE (COALESCE(${inventoryBalance.gldPurchase}, 0) * ${inventoryBalance.onHandQty} + ${unitCost} * ${qty}) / (${inventoryBalance.onHandQty} + ${qty})
              END`,
          };
        } else if (movementType === "g") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
          };
        } else if (movementType === "Z") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
          };
        } else if (movementType === "E") {
          balanceUpdate = {
            onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
            availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
          };
        } else if (movementType === "V") {
          balanceUpdate = {
            onHandQty: String(qty),
            availableQty: sql`${qty} - ${inventoryBalance.reservedQty}`,
          };
        }

        const initialOnHand =
          movementType === "L" || movementType === "R" || movementType === "g" || movementType === "E"
            ? String(-qty)
            : movementType === "V"
              ? String(qty)
              : String(movementType === "A" ? 0 : qty);

        await tx
          .insert(inventoryBalance)
          .values({
            tenantId,
            companyId: doc.companyId,
            warehouseId,
            articleId: line.articleId,
            onHandQty: movementType === "A" ? "0" : initialOnHand,
            reservedQty: movementType === "A" ? String(qty) : "0",
            availableQty: movementType === "A" ? String(-qty) : initialOnHand,
          })
          .onConflictDoUpdate({
            target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
            set: balanceUpdate,
          });

        const isStocktaking = movementType === "V";
        await tx.insert(inventoryMovement).values({
          tenantId,
          companyId: doc.companyId,
          warehouseId,
          articleId: line.articleId,
          movementType,
          qtyDelta: isStocktaking ? null : String(["L", "R", "g", "E"].includes(movementType) ? -qty : qty),
          absoluteQty: isStocktaking ? String(qty) : null,
          movementDate: now,
          sourceDocumentId: documentId,
          sourceDocumentLineId: line.documentLineId,
          transactionId: txId,
          referenceText: doc.documentNo,
        });

        if (movementType === "r") {
          // AVCO: re-read balance post-upsert and update gldCost
          const balances = await tx
            .select({
              onHandQty: inventoryBalance.onHandQty,
              gldPurchase: inventoryBalance.gldPurchase,
            })
            .from(inventoryBalance)
            .where(
              and(
                eq(inventoryBalance.tenantId, tenantId),
                eq(inventoryBalance.warehouseId, warehouseId),
                eq(inventoryBalance.articleId, line.articleId),
              ),
            )
            .limit(1);

          const currentQty = Number(balances[0]?.onHandQty ?? 0);
          // gldPurchase was updated by the SQL-level upsert above; read it as the new AVCO
          const newAvgCost = Number(balances[0]?.gldPurchase ?? 0);
          const lineQty = qty;
          const linePrice = Number(line.netPrice ?? 0);

          // Reconstruct what the avg cost was before this purchase
          const avgCostBefore =
            currentQty > lineQty
              ? (currentQty * newAvgCost - lineQty * linePrice) / (currentQty - lineQty)
              : 0;

          // Sync gldCost to match the updated weighted-average purchase cost
          await tx
            .update(inventoryBalance)
            .set({ gldCost: String(newAvgCost) })
            .where(
              and(
                eq(inventoryBalance.tenantId, tenantId),
                eq(inventoryBalance.warehouseId, warehouseId),
                eq(inventoryBalance.articleId, line.articleId),
              ),
            );

          const fiscalPeriodId = await resolveFiscalPeriodId(tenantId, doc.companyId, doc.documentDate);

          await tx.insert(factPurchaseEvent).values({
            tenantId,
            companyId: doc.companyId,
            sourceDocumentId: documentId,
            sourceDocumentLineId: line.documentLineId,
            supplierId: doc.customerId,
            articleId: line.articleId,
            eventType: "purchase",
            quantityDelta: String(lineQty),
            amountNetDelta: String(lineQty * linePrice),
            avgCostBefore: String(avgCostBefore),
            avgCostAfter: String(newAvgCost),
            fiscalPeriodId,
            bookingPeriod: doc.documentDate,
          });
        }

        if (movementType === "g") {
          // WE-Gutschrift (vendor credit note): record a correction event with negative qty
          const balances = await tx
            .select({
              gldPurchase: inventoryBalance.gldPurchase,
            })
            .from(inventoryBalance)
            .where(
              and(
                eq(inventoryBalance.tenantId, tenantId),
                eq(inventoryBalance.warehouseId, warehouseId),
                eq(inventoryBalance.articleId, line.articleId),
              ),
            )
            .limit(1);

          const avgCost = Number(balances[0]?.gldPurchase ?? 0);
          const lineQty = qty;
          const linePrice = Number(line.netPrice ?? 0);
          const fiscalPeriodId = await resolveFiscalPeriodId(tenantId, doc.companyId, doc.documentDate);

          await tx.insert(factPurchaseEvent).values({
            tenantId,
            companyId: doc.companyId,
            sourceDocumentId: documentId,
            sourceDocumentLineId: line.documentLineId,
            supplierId: doc.customerId,
            articleId: line.articleId,
            eventType: "correction",
            quantityDelta: String(-lineQty),
            amountNetDelta: String(-(lineQty * linePrice)),
            avgCostBefore: String(avgCost),
            avgCostAfter: String(avgCost),
            fiscalPeriodId,
            bookingPeriod: doc.documentDate,
          });
        }

        if (movementType === "R" || movementType === "L") {
          let cogsDelta: string | null = null;
          let fiscalPeriodId: string | null = null;

          if (movementType === "R") {
            // Get current avg cost for COGS
            const balance = await tx
              .select({ gldPurchase: inventoryBalance.gldPurchase })
              .from(inventoryBalance)
              .where(
                and(
                  eq(inventoryBalance.tenantId, tenantId),
                  eq(inventoryBalance.warehouseId, warehouseId),
                  eq(inventoryBalance.articleId, line.articleId),
                ),
              )
              .limit(1);

            const gldPurchase = Number(balance[0]?.gldPurchase ?? 0);
            cogsDelta = String(gldPurchase * Math.abs(qty));
            fiscalPeriodId = await resolveFiscalPeriodId(tenantId, doc.companyId, doc.documentDate);
          }

          await tx.insert(factSalesEvent).values({
            tenantId,
            companyId: doc.companyId,
            sourceDocumentId: documentId,
            sourceDocumentLineId: line.documentLineId,
            customerId: doc.customerId,
            articleId: line.articleId,
            eventType: movementType === "R" ? "invoice" : "delivery",
            quantityDelta: String(-qty),
            amountNetDelta: line.lineTotalNet ?? "0",
            bookingPeriod: doc.documentDate,
            transactionId: txId,
            cogsDelta,
            fiscalPeriodId,
          });
        }
      }

      const [updated] = await tx
        .update(document)
        .set({
          status: "posted",
          postedAt: now,
          postedBy: userId,
          updatedAt: now,
        })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
        .returning();

      await tx.execute(sql`SELECT pg_notify('stats_refresh', ${tenantId})`);

      return { success: true, document: updated };
    });
  }

  async stornoDocument(
    documentId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; stornoDocumentId: string }> {
    return await db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
        .limit(1);

      if (!doc) throw new Error("Document not found");
      if (doc.status !== "posted") throw new Error("Only posted documents can be reversed");

      const lines = await tx
        .select()
        .from(documentLine)
        .where(and(eq(documentLine.documentId, documentId), eq(documentLine.tenantId, tenantId)));

      const reversalTypeMap: Record<string, string> = {
        R: "G",
        r: "g",
        L: "l",
        l: "L",
        G: "R",
        g: "r",
      };
      const reversalType = reversalTypeMap[doc.documentType] ?? doc.documentType;

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId: doc.companyId,
          documentType: reversalType,
          documentDirection: doc.documentDirection,
          documentNo: `STORNO-${doc.documentNo}`,
          status: "draft",
          customerId: doc.customerId,
          currencyId: doc.currencyId,
          documentDate: doc.documentDate,
          postingDate: doc.postingDate,
          parentDocumentId: documentId,
          documentGroupId: doc.documentGroupId,
          billingAddress: doc.billingAddress,
          deliveryAddress: doc.deliveryAddress,
          paymentTermId: doc.paymentTermId,
          shippingMethodId: doc.shippingMethodId,
          documentTypeId: doc.documentTypeId,
          warehouseId: doc.warehouseId,
          targetWarehouseId: doc.targetWarehouseId,
          transactionId: crypto.randomUUID(),
        })
        .returning();

      if (lines.length > 0) {
        await tx.insert(documentLine).values(
          lines.map((l) => ({
            tenantId,
            documentId: newDoc.documentId,
            lineNo: l.lineNo,
            articleId: l.articleId,
            articleTextSnapshot: l.articleTextSnapshot,
            quantity: String(Math.abs(Number(l.quantity))),
            unit: l.unit,
            netPrice: l.netPrice,
            discountPercentage: l.discountPercentage,
            taxCodeId: l.taxCodeId,
            taxAmount: l.taxAmount ? String(Math.abs(Number(l.taxAmount))) : null,
            lineTotalNet: l.lineTotalNet ? String(Math.abs(Number(l.lineTotalNet))) : null,
            warehouseId: l.warehouseId,
            costCenterId: l.costCenterId,
            movementType: reversalType,
            lineType: l.lineType,
            transactionId: crypto.randomUUID(),
          })),
        );
      }

      await this.postDocument(newDoc.documentId, userId, tenantId);

      await tx
        .update(document)
        .set({
          stornoDocumentId: newDoc.documentId,
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)));

      return { success: true, stornoDocumentId: newDoc.documentId };
    });
  }

  async getConversionCandidates(
    documentId: string,
    tenantId: string,
  ): Promise<
    | { mode: "direct"; targetGroupId: string }
    | { mode: "select"; candidates: Array<{ documentGroupId: string; name: string; documentType: string; groupNumber: number }> }
  > {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");
    if (!doc.documentGroupId) throw new Error("No conversion target: document has no group");

    const [sourceGroup] = await db
      .select()
      .from(documentGroup)
      .where(and(eq(documentGroup.documentGroupId, doc.documentGroupId), eq(documentGroup.tenantId, tenantId)))
      .limit(1);

    if (!sourceGroup) throw new Error("Source group not found");

    if (sourceGroup.nextGroupId) {
      return { mode: "direct", targetGroupId: sourceGroup.nextGroupId };
    }

    const nextType = NEXT_TYPE[sourceGroup.documentType];
    if (!nextType) throw new Error("No next document type in sequence");

    const candidates = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.tenantId, tenantId),
          eq(documentGroup.documentType, nextType),
          eq(documentGroup.isActive, true),
        ),
      );

    if (candidates.length === 0) throw new Error("Keine Zielgruppe gefunden");

    if (candidates.length === 1) {
      return { mode: "direct", targetGroupId: candidates[0].documentGroupId };
    }

    return {
      mode: "select",
      candidates: candidates.map((g) => ({
        documentGroupId: g.documentGroupId,
        name: g.name,
        documentType: g.documentType,
        groupNumber: g.groupNumber,
      })),
    };
  }

  async convertDocument(
    documentId: string,
    userId: string,
    tenantId: string,
    targetGroupId: string,
  ): Promise<{ success: boolean; newDocumentId: string }> {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");

    const [targetGroup] = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.documentGroupId, targetGroupId),
          eq(documentGroup.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!targetGroup) throw new Error("Target document group not found");

    const lines = await db
      .select()
      .from(documentLine)
      .where(and(eq(documentLine.documentId, documentId), eq(documentLine.tenantId, tenantId)));

    return await db.transaction(async (tx) => {
      let documentNo = `DRAFT-${Date.now()}`;

      if (targetGroup.numberSequenceId) {
        const [seq] = await tx
          .select()
          .from(numberSequence)
          .where(eq(numberSequence.numberSequenceId, targetGroup.numberSequenceId))
          .limit(1)
          .for("update");

        if (seq) {
          documentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
          await tx
            .update(numberSequence)
            .set({ nextValue: seq.nextValue + 1, updatedAt: new Date() })
            .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
        }
      }

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId: doc.companyId,
          documentType: targetGroup.documentType,
          documentDirection: targetGroup.direction ?? doc.documentDirection,
          documentNo,
          status: "draft",
          customerId: doc.customerId,
          currencyId: doc.currencyId,
          documentDate: doc.documentDate,
          postingDate: doc.postingDate,
          parentDocumentId: documentId,
          documentGroupId: targetGroup.documentGroupId,
          billingAddress: doc.billingAddress,
          deliveryAddress: doc.deliveryAddress,
          paymentTermId: doc.paymentTermId,
          shippingMethodId: doc.shippingMethodId,
          warehouseId: targetGroup.defaultWarehouseId ?? doc.warehouseId,
          transactionId: crypto.randomUUID(),
        })
        .returning();

      if (lines.length > 0) {
        await tx.insert(documentLine).values(
          lines.map((l) => ({
            tenantId,
            documentId: newDoc.documentId,
            lineNo: l.lineNo,
            articleId: l.articleId,
            articleTextSnapshot: l.articleTextSnapshot,
            quantity: l.quantity,
            unit: l.unit,
            netPrice: l.netPrice,
            discountPercentage: l.discountPercentage,
            taxCodeId: l.taxCodeId,
            lineTotalNet: l.lineTotalNet,
            warehouseId: l.warehouseId,
            costCenterId: l.costCenterId,
            movementType: targetGroup.documentType,
            lineType: l.lineType,
            transactionId: crypto.randomUUID(),
          })),
        );
      }

      await tx
        .update(document)
        .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)));

      return { success: true, newDocumentId: newDoc.documentId };
    });
  }

  async getDocumentTree(tenantId: string): Promise<TreeSection[]> {
    const groups = await db
      .select()
      .from(documentGroup)
      .where(eq(documentGroup.tenantId, tenantId));

    // direction → documentType → groups[]
    const byDirection = new Map<string, Map<string, typeof groups>>();

    for (const g of groups) {
      const dir = (g.direction && g.direction.length > 0)
        ? g.direction
        : (DIRECTION_FROM_TYPE[g.documentType] ?? "OTHER");
      if (!byDirection.has(dir)) byDirection.set(dir, new Map());
      const byType = byDirection.get(dir)!;
      if (!byType.has(g.documentType)) byType.set(g.documentType, []);
      byType.get(g.documentType)!.push(g);
    }

    const buildTypes = (byType: Map<string, typeof groups>): TypeNode[] => {
      return [...byType.entries()]
        .sort(([ta], [tb]) => (TYPE_SEQUENCE[ta] ?? 99) - (TYPE_SEQUENCE[tb] ?? 99))
        .map(([docType, typeGroups]) => ({
          documentType: docType,
          typeLabel: TYPE_LABELS[docType] ?? docType,
          groups: typeGroups
            .filter((g) => g.groupNumber >= 0)
            .sort((a, b) => a.groupNumber - b.groupNumber)
            .map((g) => ({
              documentGroupId: g.documentGroupId,
              name: g.name,
              documentType: g.documentType,
              groupNumber: g.groupNumber,
            })),
        }));
    };

    const sections: TreeSection[] = [];
    const dirOrder = ["OUTBOUND", "INBOUND", "ADJUSTMENT", "PRODUCTION"];

    for (const dir of dirOrder) {
      const byType = byDirection.get(dir);
      if (!byType || byType.size === 0) continue;
      sections.push({ direction: dir, label: directionLabel(dir), types: buildTypes(byType) });
      byDirection.delete(dir);
    }

    for (const [dir, byType] of byDirection) {
      if (byType.size === 0) continue;
      sections.push({ direction: dir, label: directionLabel(dir), types: buildTypes(byType) });
    }

    return sections;
  }

  async resolveArticlePricing(
    articleId: string,
    customerId: string | null,
    documentDate: string,
    tenantId: string,
  ): Promise<{ unitPrice: string; taxCodeId: string | null }> {
    const [art] = await db
      .select()
      .from(article)
      .where(and(eq(article.articleId, articleId), eq(article.tenantId, tenantId)))
      .limit(1);

    if (!art) throw new Error("Article not found");

    if (customerId) {
      const activeLists = await db
        .select({ priceListId: priceList.priceListId })
        .from(priceList)
        .where(and(eq(priceList.tenantId, tenantId), eq(priceList.isActive, true)));

      if (activeLists.length > 0) {
        const priceListIds = activeLists.map((p) => p.priceListId);
        const [item] = await db
          .select()
          .from(priceListItem)
          .where(
            and(
              eq(priceListItem.tenantId, tenantId),
              eq(priceListItem.articleId, articleId),
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
  }

  async applyDeltaEffect(
    documentLineId: string,
    qtyDelta: number,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean }> {
    return await db.transaction(async (tx) => {
      const [line] = await tx
        .select()
        .from(documentLine)
        .where(
          and(eq(documentLine.documentLineId, documentLineId), eq(documentLine.tenantId, tenantId)),
        )
        .limit(1);

      if (!line) throw new Error("Document line not found");

      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.documentId, line.documentId), eq(document.tenantId, tenantId)))
        .limit(1);

      if (!doc) throw new Error("Parent document not found");

      const warehouseId = line.warehouseId ?? doc.warehouseId;
      if (!warehouseId || !line.articleId) return { success: true };

      const movementType = (line.movementType ?? doc.documentType) as string;
      const now = new Date();

      const isNegative = ["L", "R", "g", "E"].includes(movementType);
      const effectiveQty = isNegative ? -qtyDelta : qtyDelta;

      await tx
        .insert(inventoryBalance)
        .values({
          tenantId,
          companyId: doc.companyId,
          warehouseId,
          articleId: line.articleId,
          onHandQty: String(effectiveQty),
          reservedQty: "0",
          availableQty: String(effectiveQty),
        })
        .onConflictDoUpdate({
          target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
          set: {
            onHandQty: sql`${inventoryBalance.onHandQty} + ${effectiveQty}`,
            availableQty: sql`${inventoryBalance.onHandQty} + ${effectiveQty} - ${inventoryBalance.reservedQty}`,
          },
        });

      await tx.insert(inventoryMovement).values({
        tenantId,
        companyId: doc.companyId,
        warehouseId,
        articleId: line.articleId,
        movementType,
        qtyDelta: String(effectiveQty),
        movementDate: now,
        sourceDocumentId: doc.documentId,
        sourceDocumentLineId: documentLineId,
        referenceText: `delta:${doc.documentNo}`,
      });

      return { success: true };
    });
  }

  async createDocument(
    tenantId: string,
    data: {
      documentGroupId: string;
      documentType: string;
      documentDirection: string;
      documentDate: string;
      status: string;
      customerId?: string | null;
      billingAddress?: unknown;
      deliveryAddress?: unknown;
      deliveryAddressId?: string | null;
      currencyId?: string | null;
      warehouseId?: string | null;
      paymentTermId?: string | null;
      shippingMethodId?: string | null;
    },
  ): Promise<{ documentId: string; documentNo: string }> {
    const [grp] = await db
      .select()
      .from(documentGroup)
      .where(and(eq(documentGroup.documentGroupId, data.documentGroupId), eq(documentGroup.tenantId, tenantId)))
      .limit(1);

    if (!grp) throw new Error("Document group not found");

    let companyId = grp.companyId;
    let resolvedWarehouseId = data.warehouseId ?? grp.defaultWarehouseId ?? null;

    if (!companyId) {
      const [co] = await db
        .select({ companyId: company.companyId, defaultWarehouseId: company.defaultWarehouseId })
        .from(company)
        .where(eq(company.tenantId, tenantId))
        .limit(1);
      if (!co) throw new Error("No company found for tenant");
      companyId = co.companyId;
      if (!resolvedWarehouseId) resolvedWarehouseId = co.defaultWarehouseId ?? null;
    } else if (!resolvedWarehouseId) {
      const [co] = await db
        .select({ defaultWarehouseId: company.defaultWarehouseId })
        .from(company)
        .where(eq(company.companyId, companyId))
        .limit(1);
      if (co) resolvedWarehouseId = co.defaultWarehouseId ?? null;
    }

    return await db.transaction(async (tx) => {
      let documentNo = `DRAFT-${Date.now()}`;

      if (grp.numberSequenceId) {
        const [seq] = await tx
          .select()
          .from(numberSequence)
          .where(eq(numberSequence.numberSequenceId, grp.numberSequenceId))
          .limit(1)
          .for("update");

        if (seq) {
          documentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
          await tx
            .update(numberSequence)
            .set({ nextValue: seq.nextValue + 1, updatedAt: new Date() })
            .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
        }
      }

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId,
          documentType: data.documentType,
          documentDirection: data.documentDirection,
          documentGroupId: data.documentGroupId,
          documentNo,
          status: data.status,
          documentDate: data.documentDate,
          customerId: data.customerId ?? null,
          billingAddress: data.billingAddress ?? null,
          deliveryAddress: data.deliveryAddress ?? null,
          deliveryAddressId: data.deliveryAddressId ?? null,
          currencyId: data.currencyId ?? null,
          warehouseId: resolvedWarehouseId,
          paymentTermId: data.paymentTermId ?? null,
          shippingMethodId: data.shippingMethodId ?? null,
          transactionId: crypto.randomUUID(),
        })
        .returning();

      return { documentId: newDoc.documentId, documentNo: newDoc.documentNo };
    });
  }
}
