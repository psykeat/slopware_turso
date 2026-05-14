// Sample data for all three modules

const ADDRESS_CATEGORIES = [
  { id: "all", label: "All Addresses", count: 318, icon: "folder", level: 0 },
  { id: "customers", label: "Customers", count: 142, icon: "folderOpen", level: 1, parent: "all", open: true },
  { id: "cust-key", label: "Key Accounts", count: 18, icon: "folder", level: 2, parent: "customers" },
  { id: "cust-mid", label: "Mid-Market", count: 64, icon: "folder", level: 2, parent: "customers" },
  { id: "cust-smb", label: "SMB", count: 60, icon: "folder", level: 2, parent: "customers" },
  { id: "suppliers", label: "Suppliers", count: 87, icon: "folder", level: 1, parent: "all" },
  { id: "partners", label: "Partners", count: 41, icon: "folder", level: 1, parent: "all" },
  { id: "prospects", label: "Prospects", count: 48, icon: "folder", level: 1, parent: "all" },
  { id: "archived", label: "Archived", count: 12, icon: "folder", level: 1, parent: "all" },
];

const ADDRESSES = [
  { id: "AMS-00042", company: "Vorwerk & Söhne GmbH", contact: "Anneliese Hartmann", city: "München", country: "DE", phone: "+49 89 5573 1240", segment: "Key Account", email: "a.hartmann@vorwerk-sohne.de", street: "Maximilianstraße 28", zip: "80539", taxId: "DE 814 552 901", currency: "EUR", terms: "Net 30", created: "2021-03-14", manager: "K. Lindqvist" },
  { id: "AMS-00043", company: "Helvetia Werkzeuge AG", contact: "Reto Brunner", city: "Zürich", country: "CH", phone: "+41 44 286 9712", segment: "Key Account", email: "r.brunner@helvetia-wz.ch", street: "Bahnhofstrasse 14", zip: "8001", taxId: "CHE-114.392.708", currency: "CHF", terms: "Net 14", created: "2019-11-02", manager: "K. Lindqvist" },
  { id: "AMS-00044", company: "Nordlys Industri AS", contact: "Maja Nordeng", city: "Bergen", country: "NO", phone: "+47 55 89 12 04", segment: "Mid-Market", email: "maja@nordlys.no", street: "Strandgaten 207", zip: "5004", taxId: "NO 991 234 567", currency: "NOK", terms: "Net 30", created: "2022-06-21", manager: "P. Okonkwo" },
  { id: "AMS-00045", company: "Atelier Beaumont SAS", contact: "Camille Beaumont", city: "Lyon", country: "FR", phone: "+33 4 72 31 88 21", segment: "Mid-Market", email: "c.beaumont@ateliers-bmnt.fr", street: "12 rue Mercière", zip: "69002", taxId: "FR 09 384 762 109", currency: "EUR", terms: "Net 45", created: "2020-09-08", manager: "K. Lindqvist" },
  { id: "AMS-00046", company: "Brennan & Doyle Ltd", contact: "Siobhan Doyle", city: "Dublin", country: "IE", phone: "+353 1 678 3290", segment: "SMB", email: "siobhan@brennan-doyle.ie", street: "84 Camden Street", zip: "D02 PX23", taxId: "IE 7438291J", currency: "EUR", terms: "Net 14", created: "2023-02-17", manager: "P. Okonkwo" },
  { id: "AMS-00047", company: "Kowalski Metalworks Sp.", contact: "Tomasz Kowalski", city: "Wrocław", country: "PL", phone: "+48 71 794 6630", segment: "Mid-Market", email: "tk@kowalski-mw.pl", street: "ul. Piłsudskiego 60", zip: "50-033", taxId: "PL 8971234567", currency: "PLN", terms: "Net 30", created: "2021-08-11", manager: "P. Okonkwo" },
  { id: "AMS-00048", company: "Vega Logística S.L.", contact: "Adrián Vega", city: "Valencia", country: "ES", phone: "+34 96 312 4090", segment: "Mid-Market", email: "adrian@vega-log.es", street: "Av. del Puerto 132", zip: "46023", taxId: "ES B98274621", currency: "EUR", terms: "Net 30", created: "2022-11-04", manager: "K. Lindqvist" },
  { id: "AMS-00049", company: "Borealis Tooling Oy", contact: "Aino Mäkinen", city: "Tampere", country: "FI", phone: "+358 3 222 9410", segment: "SMB", email: "aino@borealis-t.fi", street: "Hämeenkatu 14", zip: "33100", taxId: "FI 24819307", currency: "EUR", terms: "Net 30", created: "2023-05-29", manager: "P. Okonkwo" },
  { id: "AMS-00050", company: "Östergård Verktyg AB", contact: "Lars Östergård", city: "Göteborg", country: "SE", phone: "+46 31 778 4421", segment: "Key Account", email: "lars@ostergard-vt.se", street: "Avenyn 22", zip: "411 36", taxId: "SE 5567812341", currency: "SEK", terms: "Net 30", created: "2018-04-12", manager: "K. Lindqvist" },
  { id: "AMS-00051", company: "Verde Officine Srl", contact: "Giulia Verde", city: "Bologna", country: "IT", phone: "+39 051 234 7780", segment: "SMB", email: "g.verde@verde-off.it", street: "Via Marconi 18", zip: "40122", taxId: "IT 02934761089", currency: "EUR", terms: "Net 45", created: "2022-01-22", manager: "K. Lindqvist" },
  { id: "AMS-00052", company: "Halberg Maskin A/S", contact: "Mette Halberg", city: "Aarhus", country: "DK", phone: "+45 87 32 19 04", segment: "Mid-Market", email: "mh@halberg-m.dk", street: "Strøget 41", zip: "8000", taxId: "DK 31 92 47 81", currency: "DKK", terms: "Net 30", created: "2021-10-05", manager: "P. Okonkwo" },
  { id: "AMS-00053", company: "Patel & Sons Ltd", contact: "Rahul Patel", city: "Birmingham", country: "GB", phone: "+44 121 442 7710", segment: "SMB", email: "rahul@patelsons.co.uk", street: "92 Broad Street", zip: "B1 2EP", taxId: "GB 738 4192 04", currency: "GBP", terms: "Net 30", created: "2023-08-30", manager: "P. Okonkwo" },
];

const ADDRESS_CONTACTS = [
  { name: "Anneliese Hartmann", role: "Purchasing Manager", email: "a.hartmann@vorwerk-sohne.de", phone: "+49 89 5573 1240", primary: true },
  { name: "Dietrich Vorwerk", role: "Managing Director", email: "d.vorwerk@vorwerk-sohne.de", phone: "+49 89 5573 1200" },
  { name: "Margit Sonnenfeld", role: "Accounts Payable", email: "m.sonnenfeld@vorwerk-sohne.de", phone: "+49 89 5573 1248" },
  { name: "Thomas Reichmann", role: "Operations Lead", email: "t.reichmann@vorwerk-sohne.de", phone: "+49 89 5573 1255" },
];

const ARTICLE_GROUPS = [
  { id: "all", label: "All Articles", count: 1284, icon: "folder", level: 0 },
  { id: "hw", label: "Hardware", count: 642, icon: "folderOpen", level: 1, parent: "all", open: true },
  { id: "hw-fast", label: "Fasteners", count: 218, icon: "folder", level: 2, parent: "hw" },
  { id: "hw-bear", label: "Bearings", count: 154, icon: "folder", level: 2, parent: "hw" },
  { id: "hw-stock", label: "Stock & Profiles", count: 270, icon: "folder", level: 2, parent: "hw" },
  { id: "elec", label: "Electrical", count: 312, icon: "folder", level: 1, parent: "all" },
  { id: "cons", label: "Consumables", count: 248, icon: "folder", level: 1, parent: "all" },
  { id: "pkg", label: "Packaging", count: 82, icon: "folder", level: 1, parent: "all" },
  { id: "empty", label: "Custom Fabrication", count: 0, icon: "folder", level: 1, parent: "all" },
];

const ARTICLES = [
  { id: "ART-100482", name: "Hex Bolt M8 × 30, A2-70 Stainless", unit: "pc", price: 0.42, stock: 4280, group: "Fasteners", currency: "EUR", reorder: 1000, location: "A-12-3", supplier: "Würth", weight: "16 g", lastMove: "2026-05-09" },
  { id: "ART-100483", name: "Hex Bolt M10 × 40, A2-70 Stainless", unit: "pc", price: 0.71, stock: 2410, group: "Fasteners", currency: "EUR", reorder: 800, location: "A-12-4", supplier: "Würth", weight: "29 g", lastMove: "2026-05-12" },
  { id: "ART-100484", name: "Lock Washer DIN 127, M8 Zinc", unit: "pc", price: 0.05, stock: 11200, group: "Fasteners", currency: "EUR", reorder: 3000, location: "A-13-1", supplier: "Bossard", weight: "2 g", lastMove: "2026-05-13" },
  { id: "ART-100501", name: "Deep Groove Ball Bearing 6204-2RS", unit: "pc", price: 6.80, stock: 184, group: "Bearings", currency: "EUR", reorder: 50, location: "B-04-2", supplier: "SKF", weight: "108 g", lastMove: "2026-05-08" },
  { id: "ART-100502", name: "Tapered Roller Bearing 30205", unit: "pc", price: 14.20, stock: 62, group: "Bearings", currency: "EUR", reorder: 24, location: "B-04-5", supplier: "SKF", weight: "210 g", lastMove: "2026-05-06" },
  { id: "ART-100610", name: "Aluminum Profile 30 × 30, slot 8 — 6m", unit: "m", price: 12.40, stock: 1140, group: "Stock & Profiles", currency: "EUR", reorder: 200, location: "C-01-A", supplier: "Item GmbH", weight: "0.9 kg/m", lastMove: "2026-05-11" },
  { id: "ART-100611", name: "Cold Rolled Steel Sheet 1.5mm, 1000×2000", unit: "pc", price: 38.90, stock: 92, group: "Stock & Profiles", currency: "EUR", reorder: 30, location: "C-03-B", supplier: "ThyssenKrupp", weight: "23 kg", lastMove: "2026-05-05" },
  { id: "ART-100802", name: "Cable Tie 200 × 4.8mm, Black, 100 pack", unit: "pack", price: 3.20, stock: 412, group: "Consumables", currency: "EUR", reorder: 80, location: "D-08-2", supplier: "HellermannTyton", weight: "180 g", lastMove: "2026-05-12" },
  { id: "ART-100803", name: "Cutting Fluid Synthetic, 5L canister", unit: "pc", price: 28.50, stock: 56, group: "Consumables", currency: "EUR", reorder: 16, location: "D-09-1", supplier: "Castrol", weight: "5.2 kg", lastMove: "2026-05-10" },
  { id: "ART-100920", name: "Cardboard Box 400 × 300 × 250mm, double wall", unit: "pc", price: 1.85, stock: 1280, group: "Packaging", currency: "EUR", reorder: 250, location: "E-02-3", supplier: "Klingele", weight: "320 g", lastMove: "2026-05-13" },
];

const DOCUMENT_TYPES = [
  { id: "all", label: "All Documents", count: 1842, icon: "folder", level: 0 },
  { id: "sales", label: "Sales", count: 1102, icon: "folderOpen", level: 1, parent: "all", open: true },
  { id: "sales-quotes", label: "Quotes", count: 218, icon: "folder", level: 2, parent: "sales" },
  { id: "sales-orders", label: "Orders", count: 412, icon: "folder", level: 2, parent: "sales" },
  { id: "sales-deliv", label: "Delivery Notes", count: 287, icon: "folder", level: 2, parent: "sales" },
  { id: "sales-inv", label: "Invoices", count: 185, icon: "folder", level: 2, parent: "sales" },
  { id: "purch", label: "Purchasing", count: 540, icon: "folder", level: 1, parent: "all" },
  { id: "internal", label: "Internal", count: 200, icon: "folder", level: 1, parent: "all" },
];

const DOCUMENTS = [
  { id: "SO-2026-1042", no: "SO-2026-1042", date: "2026-05-12", customer: "Vorwerk & Söhne GmbH", total: 24850.00, currency: "EUR", status: "Posted", type: "Order", lines: 14 },
  { id: "SO-2026-1041", no: "SO-2026-1041", date: "2026-05-12", customer: "Östergård Verktyg AB", total: 8420.50, currency: "SEK", status: "Open", type: "Order", lines: 6 },
  { id: "SO-2026-1040", no: "SO-2026-1040", date: "2026-05-11", customer: "Atelier Beaumont SAS", total: 12480.75, currency: "EUR", status: "Posted", type: "Order", lines: 9 },
  { id: "SO-2026-1039", no: "SO-2026-1039", date: "2026-05-11", customer: "Helvetia Werkzeuge AG", total: 31290.00, currency: "CHF", status: "Posted", type: "Order", lines: 21 },
  { id: "SO-2026-1038", no: "SO-2026-1038", date: "2026-05-10", customer: "Brennan & Doyle Ltd", total: 1825.20, currency: "EUR", status: "Draft", type: "Order", lines: 4 },
  { id: "SO-2026-1037", no: "SO-2026-1037", date: "2026-05-10", customer: "Nordlys Industri AS", total: 18420.00, currency: "NOK", status: "Posted", type: "Order", lines: 11 },
  { id: "SO-2026-1036", no: "SO-2026-1036", date: "2026-05-09", customer: "Kowalski Metalworks Sp.", total: 9740.50, currency: "PLN", status: "Open", type: "Order", lines: 7 },
  { id: "SO-2026-1035", no: "SO-2026-1035", date: "2026-05-09", customer: "Vega Logística S.L.", total: 4280.00, currency: "EUR", status: "Posted", type: "Order", lines: 5 },
  { id: "SO-2026-1034", no: "SO-2026-1034", date: "2026-05-08", customer: "Borealis Tooling Oy", total: 2150.75, currency: "EUR", status: "Cancelled", type: "Order", lines: 3 },
  { id: "SO-2026-1033", no: "SO-2026-1033", date: "2026-05-08", customer: "Verde Officine Srl", total: 6890.00, currency: "EUR", status: "Posted", type: "Order", lines: 8 },
  { id: "SO-2026-1032", no: "SO-2026-1032", date: "2026-05-07", customer: "Halberg Maskin A/S", total: 14260.40, currency: "DKK", status: "Posted", type: "Order", lines: 12 },
  { id: "SO-2026-1031", no: "SO-2026-1031", date: "2026-05-07", customer: "Patel & Sons Ltd", total: 980.25, currency: "GBP", status: "Open", type: "Order", lines: 2 },
];

const DOCUMENT_LINES = [
  { pos: 10, sku: "ART-100482", name: "Hex Bolt M8 × 30, A2-70 Stainless", qty: 2000, unit: "pc", unitPrice: 0.42, discount: 5, total: 798.00 },
  { pos: 20, sku: "ART-100483", name: "Hex Bolt M10 × 40, A2-70 Stainless", qty: 1500, unit: "pc", unitPrice: 0.71, discount: 5, total: 1011.75 },
  { pos: 30, sku: "ART-100484", name: "Lock Washer DIN 127, M8 Zinc", qty: 4000, unit: "pc", unitPrice: 0.05, discount: 0, total: 200.00 },
  { pos: 40, sku: "ART-100610", name: "Aluminum Profile 30 × 30, slot 8 — 6m", qty: 240, unit: "m", unitPrice: 12.40, discount: 8, total: 2738.88 },
  { pos: 50, sku: "ART-100611", name: "Cold Rolled Steel Sheet 1.5mm, 1000×2000", qty: 18, unit: "pc", unitPrice: 38.90, discount: 0, total: 700.20 },
  { pos: 60, sku: "ART-100920", name: "Cardboard Box 400 × 300 × 250mm, double wall", qty: 320, unit: "pc", unitPrice: 1.85, discount: 0, total: 592.00 },
  { pos: 70, sku: "ART-100802", name: "Cable Tie 200 × 4.8mm, Black, 100 pack", qty: 40, unit: "pack", unitPrice: 3.20, discount: 10, total: 115.20 },
  { pos: 80, sku: "ART-100501", name: "Deep Groove Ball Bearing 6204-2RS", qty: 24, unit: "pc", unitPrice: 6.80, discount: 0, total: 163.20 },
];

const ADMIN_USERS = [
  { id: "U-0001", name: "Karin Lindqvist", email: "karin.lindqvist@acme.io", role: "System Admin", tenant: "Acme Corp", lastLogin: "2026-05-13 09:14", status: "Active", mfa: "On" },
  { id: "U-0002", name: "Peter Okonkwo", email: "peter.okonkwo@acme.io", role: "Sales Manager", tenant: "Acme Corp", lastLogin: "2026-05-13 08:42", status: "Active", mfa: "On" },
  { id: "U-0003", name: "Mira Faulkner", email: "mira.faulkner@acme.io", role: "Accountant", tenant: "Acme Corp", lastLogin: "2026-05-12 17:30", status: "Active", mfa: "On" },
  { id: "U-0004", name: "Henrik Brandt", email: "henrik.brandt@acme.io", role: "Warehouse Lead", tenant: "Acme DE GmbH", lastLogin: "2026-05-13 06:55", status: "Active", mfa: "Off" },
  { id: "U-0005", name: "Sara El-Amin", email: "sara.elamin@acme.io", role: "Sales Rep", tenant: "Acme Corp", lastLogin: "2026-05-13 09:02", status: "Active", mfa: "On" },
  { id: "U-0006", name: "Jonas Wirth", email: "jonas.wirth@acme.io", role: "Sales Rep", tenant: "Acme DE GmbH", lastLogin: "2026-05-09 11:18", status: "Active", mfa: "On" },
  { id: "U-0007", name: "Tula Vargas", email: "tula.vargas@acme.io", role: "Procurement", tenant: "Acme Corp", lastLogin: "2026-05-12 14:08", status: "Active", mfa: "On" },
  { id: "U-0008", name: "Felix Andresen", email: "felix.andresen@acme.io", role: "Read-Only", tenant: "Acme Corp", lastLogin: "2026-04-28 10:01", status: "Suspended", mfa: "On" },
  { id: "U-0009", name: "Anika Sjöstedt", email: "anika.sjostedt@acme.io", role: "Sales Rep", tenant: "Acme Corp", lastLogin: "2026-05-13 08:11", status: "Active", mfa: "Off" },
  { id: "U-0010", name: "Marcel Beaufort", email: "marcel.beaufort@acme.io", role: "Sales Manager", tenant: "Acme Corp", lastLogin: "2026-05-13 07:47", status: "Active", mfa: "On" },
];

const SHORTCUTS = [
  { group: "Global Navigation", items: [
    { label: "Switch to Addresses", combo: ["Alt", "1"] },
    { label: "Switch to Articles", combo: ["Alt", "2"] },
    { label: "Switch to Documents", combo: ["Alt", "3"] },
    { label: "Open Settings", combo: ["Alt", "S"] },
    { label: "Switch Tenant", combo: ["Alt", "T"] },
    { label: "Open Command Palette", combo: ["⌘", "K"] },
    { label: "Show this overlay", combo: ["?"] },
    { label: "Sign Out", combo: ["⌘", "⇧", "Q"] },
  ]},
  { group: "Record Actions", items: [
    { label: "New", combo: ["F3"] },
    { label: "Edit", combo: ["F2"] },
    { label: "Archive", combo: ["F4"] },
    { label: "Duplicate", combo: ["F8"] },
    { label: "Post / Confirm", combo: ["F9"] },
    { label: "Save", combo: ["F10"] },
    { label: "Cancel / Close", combo: ["Esc"] },
    { label: "Refresh", combo: ["F5"] },
  ]},
  { group: "Grid Navigation", items: [
    { label: "Move Selection Up", combo: ["↑"] },
    { label: "Move Selection Down", combo: ["↓"] },
    { label: "Page Up", combo: ["PgUp"] },
    { label: "Page Down", combo: ["PgDn"] },
    { label: "First Row", combo: ["Home"] },
    { label: "Last Row", combo: ["End"] },
    { label: "Open Selected", combo: ["Enter"] },
    { label: "Toggle Filter Row", combo: ["⌘", "F"] },
  ]},
  { group: "Form Controls", items: [
    { label: "Next Field", combo: ["Tab"] },
    { label: "Previous Field", combo: ["⇧", "Tab"] },
    { label: "Submit Form", combo: ["F10"] },
    { label: "Cancel Form", combo: ["Esc"] },
    { label: "Pick from List", combo: ["F4"] },
    { label: "Clear Field", combo: ["⌘", "⌫"] },
    { label: "Insert Today", combo: ["⌘", "."] },
    { label: "Duplicate Field Above", combo: ["⌘", "'"] },
  ]},
];

Object.assign(window, {
  ADDRESS_CATEGORIES, ADDRESSES, ADDRESS_CONTACTS,
  ARTICLE_GROUPS, ARTICLES,
  DOCUMENT_TYPES, DOCUMENTS, DOCUMENT_LINES,
  ADMIN_USERS, SHORTCUTS,
});
