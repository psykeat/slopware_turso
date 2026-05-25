import "@tanstack/react-start/server-only";
import { eq, and, inArray, desc } from "drizzle-orm";

import { db } from "../index";
import {
  documentShipment,
  documentShipmentPackage,
  document,
  address,
  deliveryAddress,
  addressContact,
} from "../schema/app.schema";

const SHIPMENT_STATUSES = new Set(["open", "exported", "label_created", "shipped", "cancelled"]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown): string | null {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

function normalizeCountryCode(value: unknown): string {
  const text = normalizeText(value).toUpperCase();
  return text.length === 2 ? text : "";
}

function normalizeShipmentStatus(value: unknown): string {
  const status = normalizeText(value);
  if (!status) return "open";
  if (!SHIPMENT_STATUSES.has(status)) {
    throw new Error(`Invalid shipment status: ${status}`);
  }
  return status;
}

function normalizeWeightKg(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) {
    throw new Error("Package weight is required");
  }

  const normalized = raw.replace(",", ".");
  const weight = Number(normalized);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`Invalid package weight: ${raw}`);
  }

  return String(weight);
}

function parseSemicolonDelimitedLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^\uFEFF/, "").trim());
}

function normalizeHeaderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePackageLines(packageLines: Array<{ seq: number; weightKg: string }>) {
  if (!Array.isArray(packageLines) || packageLines.length === 0) {
    throw new Error("At least one package is required");
  }

  return packageLines
    .map((pkg, index) => ({
      seq: Number.isInteger(pkg.seq) && pkg.seq > 0 ? pkg.seq : index + 1,
      weightKg: normalizeWeightKg(pkg.weightKg),
    }))
    .sort((a, b) => a.seq - b.seq)
    .map((pkg, index) => ({
      seq: index + 1,
      weightKg: pkg.weightKg,
    }));
}

export class LogisticsService {
  private async getDocumentShipmentBase(tenantId: string, documentId: string) {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.tenantId, tenantId), eq(document.documentId, documentId)))
      .limit(1);

    if (!doc) {
      throw new Error("Document not found");
    }

    let recipientName = "";
    let company = "";
    let streetLine = "";
    let postalCode = "";
    let city = "";
    let countryCode = "DE";
    let email = "";
    let phone = "";

    if (doc.deliveryAddressId) {
      const [delAddr] = await db
        .select()
        .from(deliveryAddress)
        .where(
          and(
            eq(deliveryAddress.tenantId, tenantId),
            eq(deliveryAddress.deliveryAddressId, doc.deliveryAddressId),
          ),
        )
        .limit(1);

      if (delAddr) {
        recipientName = normalizeText(delAddr.name);
        streetLine = normalizeText(delAddr.addressLine1);
        postalCode = normalizeText(delAddr.postalCode);
        city = normalizeText(delAddr.city);
        countryCode = normalizeCountryCode(delAddr.countryCode);

        const [addr] = await db
          .select()
          .from(address)
          .where(and(eq(address.tenantId, tenantId), eq(address.addressId, delAddr.addressId)))
          .limit(1);

        if (addr) {
          company = normalizeText(addr.companyName);
          if (!recipientName) {
            recipientName =
              [normalizeText(addr.firstName), normalizeText(addr.lastName)]
                .filter(Boolean)
                .join(" ") || company;
          }

          const [contact] = await db
            .select()
            .from(addressContact)
            .where(
              and(
                eq(addressContact.tenantId, tenantId),
                eq(addressContact.addressId, addr.addressId),
              ),
            )
            .orderBy(desc(addressContact.isPrimary), desc(addressContact.createdAt))
            .limit(1);

          if (contact) {
            email = normalizeText(contact.email);
            phone = normalizeText(contact.phoneMobile || contact.phoneLandline);
          }
        }
      }
    }

    if (!recipientName && doc.deliveryAddress && typeof doc.deliveryAddress === "object") {
      const da = doc.deliveryAddress as Record<string, any>;
      recipientName =
        normalizeText(da.name) ||
        normalizeText(da.recipientName) ||
        [normalizeText(da.firstName), normalizeText(da.lastName)].filter(Boolean).join(" ");
      company = normalizeText(da.companyName || da.company);
      streetLine = normalizeText(da.addressLine1 || da.street);
      postalCode = normalizeText(da.postalCode);
      city = normalizeText(da.city);
      countryCode = normalizeCountryCode(da.countryCode);
      email = normalizeText(da.email);
      phone = normalizeText(da.phone || da.phoneMobile || da.phoneLandline);
    }

    if (!recipientName && doc.billingAddress && typeof doc.billingAddress === "object") {
      const ba = doc.billingAddress as Record<string, any>;
      recipientName =
        normalizeText(ba.name) ||
        normalizeText(ba.recipientName) ||
        [normalizeText(ba.firstName), normalizeText(ba.lastName)].filter(Boolean).join(" ");
      company = normalizeText(ba.companyName || ba.company);
      streetLine = normalizeText(ba.addressLine1 || ba.street);
      postalCode = normalizeText(ba.postalCode);
      city = normalizeText(ba.city);
      countryCode = normalizeCountryCode(ba.countryCode);
      email = normalizeText(ba.email);
      phone = normalizeText(ba.phone || ba.phoneMobile || ba.phoneLandline);
    }

    let street = "";
    let houseNumber = "";

    if (streetLine) {
      const match = streetLine.match(/(.*?)\s*(\d+\s*[a-zA-Z]?-?\d*)$/);
      if (match) {
        street = match[1].trim();
        houseNumber = match[2].trim();
      } else {
        street = streetLine.trim();
      }
    }

    return {
      recipientName,
      company,
      street,
      houseNumber,
      postalCode,
      city,
      countryCode,
      email,
      phone,
    };
  }

  private validateShipmentBase(base: {
    recipientName: string;
    company: string;
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    countryCode: string;
    email: string;
    phone: string;
  }) {
    const missing: string[] = [];
    if (!base.recipientName) missing.push("recipientName");
    if (!base.street) missing.push("street");
    if (!base.houseNumber) missing.push("houseNumber");
    if (!base.postalCode) missing.push("postalCode");
    if (!base.city) missing.push("city");
    if (!base.countryCode || base.countryCode.length !== 2) missing.push("countryCode");

    if (missing.length > 0) {
      throw new Error(`Shipment address incomplete: ${missing.join(", ")}`);
    }
  }

  private async createShipmentRecord(
    tenantId: string,
    documentId: string,
    base: {
      recipientName: string;
      company: string | null;
      street: string;
      houseNumber: string;
      postalCode: string;
      city: string;
      countryCode: string;
      email: string | null;
      phone: string | null;
    },
    shipmentPatch: Record<string, unknown> = {},
    packageLines?: Array<{ seq: number; weightKg: string }>,
  ) {
    const nextStatus = normalizeShipmentStatus(shipmentPatch.shipmentStatus ?? "open");
    const [newShipment] = await db
      .insert(documentShipment)
      .values({
        tenantId,
        documentId,
        shipmentStatus: nextStatus,
        carrierKey: normalizeText(shipmentPatch.carrierKey) || "dhl",
        carrierServiceKey: normalizeText(shipmentPatch.carrierServiceKey) || "paket",
        trackingId: normalizeOptionalText(shipmentPatch.trackingId),
        recipientName: normalizeText(shipmentPatch.recipientName) || base.recipientName,
        company:
          normalizeOptionalText(shipmentPatch.company) ?? normalizeOptionalText(base.company),
        street: normalizeText(shipmentPatch.street) || base.street,
        houseNumber: normalizeText(shipmentPatch.houseNumber) || base.houseNumber,
        postalCode: normalizeText(shipmentPatch.postalCode) || base.postalCode,
        city: normalizeText(shipmentPatch.city) || base.city,
        countryCode: normalizeCountryCode(shipmentPatch.countryCode) || base.countryCode,
        email: normalizeOptionalText(shipmentPatch.email) ?? normalizeOptionalText(base.email),
        phone: normalizeOptionalText(shipmentPatch.phone) ?? normalizeOptionalText(base.phone),
      })
      .returning();

    if (!newShipment) {
      throw new Error("Failed to create document shipment");
    }

    const packagesToCreate = packageLines ?? [{ seq: 1, weightKg: "1.0" }];
    if (packagesToCreate.length > 0) {
      await db.insert(documentShipmentPackage).values(
        packagesToCreate.map((pkg) => ({
          tenantId,
          documentShipmentId: newShipment.documentShipmentId,
          seq: pkg.seq,
          weightKg: pkg.weightKg,
        })),
      );
    }

    return this.getShipmentWithPackages(tenantId, documentId);
  }

  /**
   * Aggregates recipient info for a document and gets or creates a document shipment.
   * If it already exists, returns it and its packages.
   */
  async getOrCreateShipment(tenantId: string, documentId: string) {
    // 1. Check if shipment already exists
    const [existingShipment] = await db
      .select()
      .from(documentShipment)
      .where(
        and(eq(documentShipment.tenantId, tenantId), eq(documentShipment.documentId, documentId)),
      )
      .limit(1);

    if (existingShipment) {
      const packages = await db
        .select()
        .from(documentShipmentPackage)
        .where(
          and(
            eq(documentShipmentPackage.tenantId, tenantId),
            eq(documentShipmentPackage.documentShipmentId, existingShipment.documentShipmentId),
          ),
        )
        .orderBy(documentShipmentPackage.seq);

      return {
        shipment: existingShipment,
        packages,
      };
    }

    const base = await this.getDocumentShipmentBase(tenantId, documentId);
    this.validateShipmentBase(base);
    return await this.createShipmentRecord(tenantId, documentId, base);
  }

  /**
   * Fetches the shipment and its packages for a document.
   */
  async getShipmentWithPackages(tenantId: string, documentId: string) {
    const [shipment] = await db
      .select()
      .from(documentShipment)
      .where(
        and(eq(documentShipment.tenantId, tenantId), eq(documentShipment.documentId, documentId)),
      )
      .limit(1);

    if (!shipment) return null;

    const packages = await db
      .select()
      .from(documentShipmentPackage)
      .where(
        and(
          eq(documentShipmentPackage.tenantId, tenantId),
          eq(documentShipmentPackage.documentShipmentId, shipment.documentShipmentId),
        ),
      )
      .orderBy(documentShipmentPackage.seq);

    return {
      shipment,
      packages,
    };
  }

  /**
   * Updates a shipment's properties.
   */
  async updateShipment(tenantId: string, documentId: string, data: any) {
    const {
      documentShipmentId: _dsi,
      tenantId: _t,
      documentId: _d,
      createdAt: _ca,
      updatedAt: _ua,
      packages: _packages,
      ...cleanData
    } = data;

    const [existingShipment] = await db
      .select()
      .from(documentShipment)
      .where(
        and(eq(documentShipment.tenantId, tenantId), eq(documentShipment.documentId, documentId)),
      )
      .limit(1);

    if (!existingShipment) {
      const base = await this.getDocumentShipmentBase(tenantId, documentId);
      const nextShipment = {
        recipientName: Object.prototype.hasOwnProperty.call(cleanData, "recipientName")
          ? normalizeText(cleanData.recipientName)
          : base.recipientName,
        company: Object.prototype.hasOwnProperty.call(cleanData, "company")
          ? normalizeOptionalText(cleanData.company)
          : normalizeOptionalText(base.company),
        street: Object.prototype.hasOwnProperty.call(cleanData, "street")
          ? normalizeText(cleanData.street)
          : base.street,
        houseNumber: Object.prototype.hasOwnProperty.call(cleanData, "houseNumber")
          ? normalizeText(cleanData.houseNumber)
          : base.houseNumber,
        postalCode: Object.prototype.hasOwnProperty.call(cleanData, "postalCode")
          ? normalizeText(cleanData.postalCode)
          : base.postalCode,
        city: Object.prototype.hasOwnProperty.call(cleanData, "city")
          ? normalizeText(cleanData.city)
          : base.city,
        countryCode: Object.prototype.hasOwnProperty.call(cleanData, "countryCode")
          ? normalizeCountryCode(cleanData.countryCode)
          : base.countryCode,
        email: Object.prototype.hasOwnProperty.call(cleanData, "email")
          ? normalizeOptionalText(cleanData.email)
          : normalizeOptionalText(base.email),
        phone: Object.prototype.hasOwnProperty.call(cleanData, "phone")
          ? normalizeOptionalText(cleanData.phone)
          : normalizeOptionalText(base.phone),
      };
      this.validateShipmentBase({
        recipientName: nextShipment.recipientName,
        company: nextShipment.company ?? "",
        street: nextShipment.street,
        houseNumber: nextShipment.houseNumber,
        postalCode: nextShipment.postalCode,
        city: nextShipment.city,
        countryCode: nextShipment.countryCode,
        email: nextShipment.email ?? "",
        phone: nextShipment.phone ?? "",
      });

      const packageLines = Array.isArray(cleanData.packages)
        ? normalizePackageLines(cleanData.packages)
        : undefined;
      const created = await this.createShipmentRecord(
        tenantId,
        documentId,
        {
          ...base,
          ...nextShipment,
        },
        cleanData,
        packageLines,
      );
      return created?.shipment;
    }

    const nextShipment = {
      shipmentStatus: Object.prototype.hasOwnProperty.call(cleanData, "shipmentStatus")
        ? normalizeShipmentStatus(cleanData.shipmentStatus)
        : existingShipment.shipmentStatus,
      carrierKey: Object.prototype.hasOwnProperty.call(cleanData, "carrierKey")
        ? normalizeText(cleanData.carrierKey) || existingShipment.carrierKey
        : existingShipment.carrierKey,
      carrierServiceKey: Object.prototype.hasOwnProperty.call(cleanData, "carrierServiceKey")
        ? normalizeText(cleanData.carrierServiceKey) || existingShipment.carrierServiceKey
        : existingShipment.carrierServiceKey,
      trackingId: Object.prototype.hasOwnProperty.call(cleanData, "trackingId")
        ? normalizeOptionalText(cleanData.trackingId)
        : existingShipment.trackingId,
      recipientName: Object.prototype.hasOwnProperty.call(cleanData, "recipientName")
        ? normalizeText(cleanData.recipientName) || existingShipment.recipientName
        : existingShipment.recipientName,
      company: Object.prototype.hasOwnProperty.call(cleanData, "company")
        ? normalizeOptionalText(cleanData.company)
        : existingShipment.company,
      street: Object.prototype.hasOwnProperty.call(cleanData, "street")
        ? normalizeText(cleanData.street) || existingShipment.street
        : existingShipment.street,
      houseNumber: Object.prototype.hasOwnProperty.call(cleanData, "houseNumber")
        ? normalizeText(cleanData.houseNumber) || existingShipment.houseNumber
        : existingShipment.houseNumber,
      postalCode: Object.prototype.hasOwnProperty.call(cleanData, "postalCode")
        ? normalizeText(cleanData.postalCode) || existingShipment.postalCode
        : existingShipment.postalCode,
      city: Object.prototype.hasOwnProperty.call(cleanData, "city")
        ? normalizeText(cleanData.city) || existingShipment.city
        : existingShipment.city,
      countryCode: Object.prototype.hasOwnProperty.call(cleanData, "countryCode")
        ? normalizeCountryCode(cleanData.countryCode) || existingShipment.countryCode
        : existingShipment.countryCode,
      email: Object.prototype.hasOwnProperty.call(cleanData, "email")
        ? normalizeOptionalText(cleanData.email)
        : existingShipment.email,
      phone: Object.prototype.hasOwnProperty.call(cleanData, "phone")
        ? normalizeOptionalText(cleanData.phone)
        : existingShipment.phone,
    };

    this.validateShipmentBase({
      recipientName: nextShipment.recipientName,
      company: nextShipment.company ?? "",
      street: nextShipment.street,
      houseNumber: nextShipment.houseNumber,
      postalCode: nextShipment.postalCode,
      city: nextShipment.city,
      countryCode: nextShipment.countryCode,
      email: nextShipment.email ?? "",
      phone: nextShipment.phone ?? "",
    });

    const [updatedShipment] = await db
      .update(documentShipment)
      .set({
        ...nextShipment,
        updatedAt: new Date(),
      })
      .where(
        and(eq(documentShipment.tenantId, tenantId), eq(documentShipment.documentId, documentId)),
      )
      .returning();

    return updatedShipment;
  }

  /**
   * Re-saves the packages for a shipment (deletes existing ones and inserts new list).
   */
  async savePackages(
    tenantId: string,
    documentShipmentId: string,
    packageLines: Array<{ seq: number; weightKg: string }>,
  ) {
    const normalizedLines = normalizePackageLines(packageLines);
    return await db.transaction(async (tx) => {
      // Delete existing packages for the shipment
      await tx
        .delete(documentShipmentPackage)
        .where(
          and(
            eq(documentShipmentPackage.tenantId, tenantId),
            eq(documentShipmentPackage.documentShipmentId, documentShipmentId),
          ),
        );

      // Insert new packages
      if (normalizedLines.length > 0) {
        const valuesToInsert = normalizedLines.map((pkg) => ({
          tenantId,
          documentShipmentId,
          seq: pkg.seq,
          weightKg: pkg.weightKg,
        }));

        await tx.insert(documentShipmentPackage).values(valuesToInsert);
      }

      // Return the newly saved packages
      return await tx
        .select()
        .from(documentShipmentPackage)
        .where(
          and(
            eq(documentShipmentPackage.tenantId, tenantId),
            eq(documentShipmentPackage.documentShipmentId, documentShipmentId),
          ),
        )
        .orderBy(documentShipmentPackage.seq);
    });
  }

  /**
   * Fetches/creates shipments for the given document IDs and generates a DHL GKP CSV string.
   */
  async exportShipmentsCSV(tenantId: string, documentIds: string[]): Promise<string> {
    const shipmentsAndPackages: Array<{ shipment: any; packages: any[]; documentNo: string }> = [];

    for (const documentId of documentIds) {
      const result = await this.getOrCreateShipment(tenantId, documentId);
      if (!result) {
        throw new Error(`Failed to resolve shipment for document ${documentId}`);
      }

      const [doc] = await db
        .select({ documentNo: document.documentNo })
        .from(document)
        .where(and(eq(document.tenantId, tenantId), eq(document.documentId, documentId)))
        .limit(1);

      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      shipmentsAndPackages.push({
        shipment: result.shipment,
        packages: result.packages,
        documentNo: doc.documentNo,
      });
    }

    // DHL CSV format details
    const headers = [
      "Sendungsreferenz",
      "Empfänger Name 1",
      "Empfänger Name 2",
      "Straße",
      "Hausnummer",
      "PLZ",
      "Ort",
      "Land",
      "E-Mail",
      "Telefon",
      "Gewicht",
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return "";
      const str = String(val).trim();
      if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows: string[] = [headers.join(";")];

    for (const item of shipmentsAndPackages) {
      const { shipment, packages, documentNo } = item;
      if (packages.length === 0) {
        throw new Error(`Shipment ${documentNo} has no packages`);
      }

      for (const pkg of packages) {
        const row = [
          escapeCsv(documentNo),
          escapeCsv(shipment.recipientName),
          escapeCsv(shipment.company),
          escapeCsv(shipment.street),
          escapeCsv(shipment.houseNumber),
          escapeCsv(shipment.postalCode),
          escapeCsv(shipment.city),
          escapeCsv(shipment.countryCode),
          escapeCsv(shipment.email),
          escapeCsv(shipment.phone),
          escapeCsv(pkg.weightKg),
        ];
        csvRows.push(row.join(";"));
      }
    }

    // Set shipmentStatus to 'exported' and exportedAt to now() for all exported shipments
    const shipmentIds = shipmentsAndPackages.map((item) => item.shipment.documentShipmentId);
    if (shipmentIds.length > 0) {
      await db
        .update(documentShipment)
        .set({
          shipmentStatus: "exported",
          exportedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(documentShipment.tenantId, tenantId),
            inArray(documentShipment.documentShipmentId, shipmentIds),
          ),
        );
    }

    return csvRows.join("\r\n");
  }

  /**
   * Parses DHL feedback CSV, updates trackingId and sets shipmentStatus to 'label_created'.
   */
  async importTrackingCSV(tenantId: string, csvContent: string): Promise<{ updatedCount: number }> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return { updatedCount: 0 };
    }

    // Parse header and clean values
    const headerCells = parseSemicolonDelimitedLine(lines[0]).map((cell) =>
      normalizeHeaderToken(cell),
    );

    let refIndex = -1;
    let trackingIndex = -1;

    const refNames = [
      "sendungsreferenz",
      "belegnummer",
      "referenz",
      "referenznummer",
      "refno",
      "documentno",
      "beleg",
      "auftragsnummer",
    ];
    const trackingNames = [
      "sendungsnummer",
      "trackingid",
      "trackingnummer",
      "barcode",
      "paketnummer",
      "trackingnumber",
      "trackingidnumber",
      "shipmentnumber",
    ];

    for (let i = 0; i < headerCells.length; i++) {
      const cell = headerCells[i];
      if (refIndex === -1 && refNames.some((name) => cell.includes(name))) {
        refIndex = i;
      }
      if (trackingIndex === -1 && trackingNames.some((name) => cell.includes(name))) {
        trackingIndex = i;
      }
    }

    // Fallback if headers don't match
    if (refIndex === -1) refIndex = 0;
    if (trackingIndex === -1) trackingIndex = 1;

    let updatedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const rowCells = parseSemicolonDelimitedLine(lines[i]);
      const documentNo = rowCells[refIndex];
      const trackingId = rowCells[trackingIndex];

      if (!documentNo || !trackingId) {
        continue;
      }

      // Find the documentId corresponding to this documentNo
      const [doc] = await db
        .select({ documentId: document.documentId })
        .from(document)
        .where(and(eq(document.tenantId, tenantId), eq(document.documentNo, documentNo)))
        .limit(1);

      if (doc) {
        const [shipment] = await db
          .select()
          .from(documentShipment)
          .where(
            and(
              eq(documentShipment.tenantId, tenantId),
              eq(documentShipment.documentId, doc.documentId),
            ),
          )
          .limit(1);

        if (shipment) {
          await db
            .update(documentShipment)
            .set({
              trackingId: normalizeText(trackingId),
              shipmentStatus: "label_created",
              labelCreatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(documentShipment.tenantId, tenantId),
                eq(documentShipment.documentShipmentId, shipment.documentShipmentId),
              ),
            );

          updatedCount++;
        }
      }
    }

    return { updatedCount };
  }
}
