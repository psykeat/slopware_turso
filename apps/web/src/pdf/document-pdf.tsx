import { Document, Page, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DocumentLine {
  documentLineId: string;
  lineNo: number;
  articleTextSnapshot: string | null;
  quantity: string | null;
  unit: string | null;
  netPrice: string | null;
  discountPercentage: string | null;
  taxAmount: string | null;
  lineTotalNet: string | null;
  lineType: string;
}

export interface DocumentForPrint {
  documentId: string;
  documentNo: string;
  documentType: string;
  documentDate: string | null;
  billingAddress: Record<string, any> | null;
  deliveryAddress: Record<string, any> | null;
  totalNet: string | null;
  totalTax: string | null;
  totalGross: string | null;
  currencyId: string | null;
  lines: DocumentLine[];
}

export interface CompanyForPrint {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  vatId: string | null;
  taxNumber: string | null;
  email: string | null;
  homepage: string | null;
  phoneLandline: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankBic: string | null;
}

interface DocumentPDFProps {
  doc: DocumentForPrint;
  company: CompanyForPrint;
  typeLabel: string;
}

// ---------------------------------------------------------------------------
// Type labels
// ---------------------------------------------------------------------------

export const TYPE_LABELS: Record<string, string> = {
  N: "Angebot",
  A: "Auftrag",
  L: "Lieferschein",
  R: "Rechnung",
  G: "Gutschrift",
  b: "Bestellung",
  l: "WE-Lieferschein",
  r: "WE-Rechnung",
  g: "WE-Gutschrift",
  V: "Inventurbuchung",
  Z: "Zubuchung",
  E: "Entnahme",
  U: "Umlagerung",
  q: "Produktionsauftrag",
  p: "Fertigmeldung",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(s: string | null): string {
  if (!s) return "";
  // Expect ISO date YYYY-MM-DD (ignore any time part)
  const parts = s.substring(0, 10).split("-");
  if (parts.length !== 3) return s;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

function formatNum(s: string | null, decimals = 2): string {
  if (s === null || s === undefined) return "";
  const n = parseFloat(s);
  if (isNaN(n)) return "";
  // toFixed gives us e.g. "1234.50"
  const fixed = n.toFixed(decimals);
  // Split on decimal point
  const [intPart, decPart] = fixed.split(".");
  // Add thousand separator (dot) to integer part
  const intFormatted = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart !== undefined ? `${intFormatted},${decPart}` : intFormatted;
}

function fmtAmt(s: string | null, currency: string | null): string {
  const num = formatNum(s);
  if (!num) return "";
  return `${num} ${currency ?? "EUR"}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const C = {
  primary: "#2563eb",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  rowAlt: "#f8fafc",
  tableHeaderBg: "#f1f5f9",
  tableHeaderBorder: "#e2e8f0",
  footerBorder: "#e5e7eb",
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
    paddingTop: 56.69, // ~2 cm in pt
    paddingLeft: 56.69,
    paddingRight: 56.69,
    paddingBottom: 70.87, // ~2.5 cm in pt
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  senderBlock: {
    width: "55%",
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 2,
    color: C.text,
  },
  senderLine: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.4,
  },
  senderMuted: {
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.4,
    marginTop: 2,
  },
  docInfoBlock: {
    width: "40%",
    textAlign: "right",
  },
  docTypeLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: C.text,
    marginBottom: 4,
  },
  docNo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: C.primary,
    marginBottom: 2,
  },
  docDate: {
    fontSize: 9,
    color: C.muted,
  },

  // Divider
  hr: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: "solid",
    marginVertical: 12,
  },

  // Recipient
  recipientBlock: {
    width: "55%",
  },
  recipientLine: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.4,
  },
  recipientName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: C.text,
    lineHeight: 1.4,
    marginBottom: 1,
  },
  deliveryLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    marginTop: 8,
    marginBottom: 1,
  },
  deliveryLine: {
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.4,
  },

  // Table
  table: {
    marginTop: 16,
    width: "100%",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.tableHeaderBg,
    borderBottomWidth: 1,
    borderBottomColor: C.tableHeaderBorder,
    borderBottomStyle: "solid",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: C.rowAlt,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.muted,
  },
  tableCell: {
    fontSize: 8,
    color: C.text,
  },
  tableCellRight: {
    fontSize: 8,
    color: C.text,
    textAlign: "right",
  },
  tableCellComment: {
    fontSize: 8,
    color: C.muted,
    fontStyle: "italic",
    width: "100%",
  },

  // Column widths
  colPos: { width: "5%" },
  colDesc: { width: "45%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "8%", textAlign: "right" },
  colEp: { width: "12%", textAlign: "right" },
  colDisc: { width: "8%", textAlign: "right" },
  colNet: { width: "12%", textAlign: "right" },

  // Totals
  totalsWrapper: {
    alignItems: "flex-end",
    marginTop: 12,
  },
  totalsBlock: {
    width: "35%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsLabel: {
    fontSize: 9,
    color: C.muted,
  },
  totalsValue: {
    fontSize: 9,
    color: C.text,
    textAlign: "right",
  },
  totalsGrossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: "solid",
    marginTop: 2,
  },
  totalsGrossLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: C.text,
  },
  totalsGrossValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: C.text,
    textAlign: "right",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56.69,
    right: 56.69,
    borderTopWidth: 1,
    borderTopColor: C.footerBorder,
    borderTopStyle: "solid",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerLeft: {
    fontSize: 7,
    color: C.muted,
    lineHeight: 1.4,
  },
  footerRight: {
    fontSize: 7,
    color: C.muted,
    textAlign: "right",
    lineHeight: 1.4,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AddressBlock({ addr, style }: { addr: Record<string, any>; style?: Styles[string] }) {
  const name = addr.companyName || addr.name || null;
  const line1 = addr.addressLine1 || null;
  const line2 = addr.addressLine2 || null;
  const postal = addr.postalCode || "";
  const city = addr.city || "";

  return (
    <View style={style}>
      {name ? <Text style={styles.recipientName}>{name}</Text> : null}
      {line1 ? <Text style={styles.recipientLine}>{line1}</Text> : null}
      {line2 ? <Text style={styles.recipientLine}>{line2}</Text> : null}
      {postal || city ? (
        <Text style={styles.recipientLine}>{`${postal} ${city}`.trim()}</Text>
      ) : null}
    </View>
  );
}

function DeliveryAddressBlock({ addr }: { addr: Record<string, any> }) {
  const name = addr.companyName || addr.name || null;
  const line1 = addr.addressLine1 || null;
  const line2 = addr.addressLine2 || null;
  const postal = addr.postalCode || "";
  const city = addr.city || "";

  return (
    <View>
      <Text style={styles.deliveryLabel}>Lieferadresse:</Text>
      {name ? <Text style={styles.deliveryLine}>{name}</Text> : null}
      {line1 ? <Text style={styles.deliveryLine}>{line1}</Text> : null}
      {line2 ? <Text style={styles.deliveryLine}>{line2}</Text> : null}
      {postal || city ? (
        <Text style={styles.deliveryLine}>{`${postal} ${city}`.trim()}</Text>
      ) : null}
    </View>
  );
}

// Check if two address objects differ meaningfully
function addressesDiffer(a: Record<string, any> | null, b: Record<string, any> | null): boolean {
  if (!a || !b) return false;
  const fields = ["companyName", "name", "addressLine1", "addressLine2", "postalCode", "city"];
  return fields.some((f) => (a[f] ?? "") !== (b[f] ?? ""));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function DocumentPDF({ doc, company, typeLabel }: DocumentPDFProps) {
  const currency = doc.currencyId;
  const showDelivery =
    !!doc.deliveryAddress && addressesDiffer(doc.billingAddress, doc.deliveryAddress);

  // Build footer strings
  const footerLeftParts: string[] = [company.name];
  if (company.vatId) footerLeftParts.push(`UID: ${company.vatId}`);
  if (company.bankIban) {
    const bankStr = company.bankBic
      ? `IBAN: ${company.bankIban}  BIC: ${company.bankBic}`
      : `IBAN: ${company.bankIban}`;
    footerLeftParts.push(bankStr);
  }

  const footerRightParts: string[] = [];
  if (company.email) footerRightParts.push(company.email);
  if (company.homepage) footerRightParts.push(company.homepage);
  if (company.phoneLandline) footerRightParts.push(company.phoneLandline);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ---- Header ---- */}
        <View style={styles.headerRow}>
          {/* Sender */}
          <View style={styles.senderBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.addressLine1 ? (
              <Text style={styles.senderLine}>{company.addressLine1}</Text>
            ) : null}
            {company.addressLine2 ? (
              <Text style={styles.senderLine}>{company.addressLine2}</Text>
            ) : null}
            {company.postalCode || company.city ? (
              <Text style={styles.senderLine}>
                {`${company.postalCode ?? ""} ${company.city ?? ""}`.trim()}
              </Text>
            ) : null}
            <Text style={styles.senderLine}>{company.countryCode}</Text>
            {company.vatId ? (
              <Text style={styles.senderMuted}>UID: {company.vatId}</Text>
            ) : company.taxNumber ? (
              <Text style={styles.senderMuted}>Steuernr: {company.taxNumber}</Text>
            ) : null}
          </View>

          {/* Document info */}
          <View style={styles.docInfoBlock}>
            <Text style={styles.docTypeLabel}>{typeLabel}</Text>
            <Text style={styles.docNo}>{doc.documentNo}</Text>
            <Text style={styles.docDate}>{formatDate(doc.documentDate)}</Text>
          </View>
        </View>

        {/* ---- Horizontal rule ---- */}
        <View style={styles.hr} />

        {/* ---- Recipient ---- */}
        {doc.billingAddress ? (
          <AddressBlock addr={doc.billingAddress} style={styles.recipientBlock} />
        ) : null}

        {/* ---- Delivery address ---- */}
        {showDelivery && doc.deliveryAddress ? (
          <DeliveryAddressBlock addr={doc.deliveryAddress} />
        ) : null}

        {/* ---- Positions table ---- */}
        <View style={styles.table}>
          {/* Table header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colPos]}>Pos</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Bezeichnung</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty, { textAlign: "right" }]}>
              Menge
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit, { textAlign: "right" }]}>
              Einheit
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colEp, { textAlign: "right" }]}>EP</Text>
            <Text style={[styles.tableHeaderCell, styles.colDisc, { textAlign: "right" }]}>R%</Text>
            <Text style={[styles.tableHeaderCell, styles.colNet, { textAlign: "right" }]}>
              Netto
            </Text>
          </View>

          {/* Table rows */}
          {doc.lines.map((line, idx) => {
            const isAlt = idx % 2 !== 0;
            const rowStyle = isAlt ? [styles.tableRow, styles.tableRowAlt] : [styles.tableRow];

            if (line.lineType === "comment") {
              return (
                <View key={line.documentLineId} style={rowStyle}>
                  <Text style={styles.tableCellComment}>{line.articleTextSnapshot ?? ""}</Text>
                </View>
              );
            }

            const disc = line.discountPercentage ? `${formatNum(line.discountPercentage)}%` : "";

            return (
              <View key={line.documentLineId} style={rowStyle}>
                <Text style={[styles.tableCell, styles.colPos]}>{line.lineNo}</Text>
                <Text style={[styles.tableCell, styles.colDesc]}>
                  {line.articleTextSnapshot ?? ""}
                </Text>
                <Text style={[styles.tableCellRight, styles.colQty]}>
                  {formatNum(line.quantity)}
                </Text>
                <Text style={[styles.tableCellRight, styles.colUnit]}>{line.unit ?? ""}</Text>
                <Text style={[styles.tableCellRight, styles.colEp]}>
                  {formatNum(line.netPrice)}
                </Text>
                <Text style={[styles.tableCellRight, styles.colDisc]}>{disc}</Text>
                <Text style={[styles.tableCellRight, styles.colNet]}>
                  {formatNum(line.lineTotalNet)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ---- Totals ---- */}
        <View style={styles.totalsWrapper}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Netto:</Text>
              <Text style={styles.totalsValue}>{fmtAmt(doc.totalNet, currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>MwSt:</Text>
              <Text style={styles.totalsValue}>{fmtAmt(doc.totalTax, currency)}</Text>
            </View>
            <View style={styles.totalsGrossRow}>
              <Text style={styles.totalsGrossLabel}>Brutto:</Text>
              <Text style={styles.totalsGrossValue}>{fmtAmt(doc.totalGross, currency)}</Text>
            </View>
          </View>
        </View>

        {/* ---- Footer ---- */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>{footerLeftParts.join("  |  ")}</Text>
          <Text style={styles.footerRight}>{footerRightParts.join("  |  ")}</Text>
        </View>
      </Page>
    </Document>
  );
}

export default DocumentPDF;
