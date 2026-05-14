// Module views: Addresses, Articles, Documents, Admin

const AddressTabs = ({ row, openMask = false }) => {
  const [tab, setTab] = React.useState("details");
  const tabs = [
    { id: "details", label: "Details" },
    { id: "contacts", label: "Contacts", count: ADDRESS_CONTACTS.length },
    { id: "delivery", label: "Delivery Addresses", count: 2 },
    { id: "documents", label: "Related Documents", count: 7 },
  ];

  if (openMask) {
    return <EntityMask mode="create" values={{ category: "customers", country: "DE", currency: "EUR", terms: "Net 30" }}/>;
  }

  return (
    <ContextTabs tabs={tabs} active={tab} onChange={setTab}>
      {tab === "details" && (
        <InspectorPanel
          title={row.company}
          id={row.id}
          sections={[
            { title: "Identification", fields: [
              { label: "Address No.", value: row.id, mono: true },
              { label: "Segment", value: row.segment },
              { label: "Primary Contact", value: row.contact },
              { label: "Email", value: row.email, mono: true },
            ]},
            { title: "Postal Address", fields: [
              { label: "Street", value: row.street, full: true },
              { label: "ZIP", value: row.zip },
              { label: "City", value: row.city },
              { label: "Country", value: row.country },
              { label: "Phone", value: row.phone, mono: true },
            ]},
            { title: "Commercial", fields: [
              { label: "VAT / Tax ID", value: row.taxId, mono: true },
              { label: "Currency", value: row.currency },
              { label: "Payment Terms", value: row.terms },
              { label: "Account Manager", value: row.manager },
              { label: "Created", value: row.created, mono: true },
              { label: "Status", value: (<span><span className="dot" style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }}/>Active</span>) },
            ]},
          ]}
        />
      )}
      {tab === "contacts" && (
        <div className="tab-list">
          {ADDRESS_CONTACTS.map((c, i) => (
            <div key={i} className="contact-row">
              <div className="contact-avatar">{c.name.split(" ").map(p => p[0]).slice(0, 2).join("")}</div>
              <div>
                <div className="contact-name">{c.name}{c.primary && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Primary</span>}</div>
                <div className="contact-role">{c.role}</div>
              </div>
              <div className="contact-meta">
                <div>{c.email}</div>
                <div>{c.phone}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "delivery" && (
        <div className="tab-list">
          <div className="contact-row">
            <div className="contact-avatar"><Icon name="truck" size={14}/></div>
            <div>
              <div className="contact-name">Werk 1 — Wareneingang</div>
              <div className="contact-role">Maximilianstraße 28, 80539 München, DE</div>
            </div>
            <div className="contact-meta">Default</div>
          </div>
          <div className="contact-row">
            <div className="contact-avatar"><Icon name="truck" size={14}/></div>
            <div>
              <div className="contact-name">Lager Süd</div>
              <div className="contact-role">Industriestraße 4, 85551 Kirchheim, DE</div>
            </div>
            <div className="contact-meta">Mon–Fri 07–17</div>
          </div>
        </div>
      )}
      {tab === "documents" && (
        <div style={{ padding: 0 }}>
          <DataGrid
            toolbar={false}
            columns={[
              { key: "no", label: "Document", width: "30%" },
              { key: "date", label: "Date", width: "16%", render: r => <span className="tnum">{r.date}</span> },
              { key: "type", label: "Type", width: "16%" },
              { key: "total", label: "Total", num: true, width: "22%", render: r => <span>{formatMoney(r.total, r.currency)}</span> },
              { key: "status", label: "Status", width: "16%", render: r => (
                <span className="status-cell"><span className={"dot " + (r.status === "Posted" ? "" : r.status === "Open" ? "warn" : "mute")}/>{r.status}</span>
              )},
            ]}
            rows={DOCUMENTS.slice(0, 7)}
          />
        </div>
      )}
    </ContextTabs>
  );
};

const ArticleTabs = ({ row }) => {
  const [tab, setTab] = React.useState("details");
  const tabs = [
    { id: "details", label: "Details" },
    { id: "moves", label: "Inventory Movements", count: 24 },
  ];
  return (
    <ContextTabs tabs={tabs} active={tab} onChange={setTab}>
      {tab === "details" && row && (
        <InspectorPanel
          title={row.name}
          id={row.id}
          sections={[
            { title: "Identification", fields: [
              { label: "Article No.", value: row.id, mono: true },
              { label: "Group", value: row.group },
              { label: "Unit", value: row.unit },
              { label: "Supplier", value: row.supplier },
            ]},
            { title: "Pricing & Stock", fields: [
              { label: "Sales Price", value: formatMoney(row.price, row.currency), mono: true },
              { label: "Stock", value: <span className="tnum">{row.stock.toLocaleString()} {row.unit}</span> },
              { label: "Reorder Point", value: <span className="tnum">{row.reorder.toLocaleString()} {row.unit}</span> },
              { label: "Storage Location", value: row.location, mono: true },
              { label: "Unit Weight", value: row.weight },
              { label: "Last Movement", value: row.lastMove, mono: true },
            ]},
          ]}
        />
      )}
      {tab === "moves" && (
        <div className="tab-content-empty">Inventory movement log placeholder — receipts, issues, transfers.</div>
      )}
    </ContextTabs>
  );
};

const DocumentTabs = ({ row }) => {
  const [tab, setTab] = React.useState("lines");
  const tabs = [
    { id: "lines", label: "Lines", count: row?.lines || 0 },
    { id: "header", label: "Header Details" },
  ];
  return (
    <ContextTabs tabs={tabs} active={tab} onChange={setTab}>
      {tab === "lines" && (
        <div style={{ padding: 0 }}>
          <DataGrid
            toolbar={false}
            columns={[
              { key: "pos", label: "Pos.", num: true, width: 60, render: r => <span className="tnum">{r.pos.toString().padStart(3, "0")}</span> },
              { key: "sku", label: "Article", width: 130, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.sku}</span> },
              { key: "name", label: "Description" },
              { key: "qty", label: "Qty", num: true, width: 90, render: r => <span className="tnum">{r.qty.toLocaleString()} {r.unit}</span> },
              { key: "unitPrice", label: "Unit Price", num: true, width: 100, render: r => <span className="tnum">{r.unitPrice.toFixed(2)}</span> },
              { key: "discount", label: "Disc.", num: true, width: 70, render: r => <span className="tnum">{r.discount > 0 ? `${r.discount}%` : "—"}</span> },
              { key: "total", label: "Line Total", num: true, width: 110, render: r => <span className="tnum">{r.total.toFixed(2)}</span> },
            ]}
            rows={DOCUMENT_LINES}
          />
        </div>
      )}
      {tab === "header" && (
        <InspectorPanel
          title={row.no}
          id={row.id}
          sections={[
            { title: "Document", fields: [
              { label: "Number", value: row.no, mono: true },
              { label: "Type", value: row.type },
              { label: "Date", value: row.date, mono: true },
              { label: "Currency", value: row.currency },
            ]},
            { title: "Parties", fields: [
              { label: "Customer", value: row.customer, full: true },
              { label: "Payment Terms", value: "Net 30" },
              { label: "Account Manager", value: "K. Lindqvist" },
            ]},
            { title: "Totals", fields: [
              { label: "Lines", value: <span className="tnum">{row.lines}</span> },
              { label: "Subtotal", value: <span className="tnum">{formatMoney(row.total / 1.19, row.currency)}</span> },
              { label: "VAT 19%", value: <span className="tnum">{formatMoney(row.total - row.total / 1.19, row.currency)}</span> },
              { label: "Grand Total", value: <span className="tnum" style={{ fontWeight: 400 }}>{formatMoney(row.total, row.currency)}</span> },
            ]},
          ]}
        />
      )}
    </ContextTabs>
  );
};

const AdminUsersView = () => {
  const [selected, setSelected] = React.useState("U-0001");
  return (
    <div className="workspace">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DataGrid
          title="Users"
          count={ADMIN_USERS.length}
          selected={selected}
          onSelect={setSelected}
          columns={[
            { key: "id", label: "User ID", width: 110, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.id}</span> },
            { key: "name", label: "Name", width: 200 },
            { key: "email", label: "Email", width: 260 },
            { key: "role", label: "Role", width: 140 },
            { key: "tenant", label: "Tenant", width: 160 },
            { key: "mfa", label: "MFA", width: 70, render: r => (
              <span className="status-cell" style={{ color: r.mfa === "On" ? "var(--ink)" : "var(--ink-mute)" }}>
                <span className={"dot " + (r.mfa === "On" ? "" : "mute")}/>{r.mfa}
              </span>
            )},
            { key: "lastLogin", label: "Last Login", width: 150, render: r => <span className="tnum">{r.lastLogin}</span> },
            { key: "status", label: "Status", width: 110, render: r => (
              <span className="status-cell" style={{ color: r.status === "Active" ? "var(--ink)" : "var(--ink-mute)" }}>
                <span className={"dot " + (r.status === "Active" ? "" : "mute")}/>{r.status}
              </span>
            )},
          ]}
          rows={ADMIN_USERS}
        />
      </div>
    </div>
  );
};

Object.assign(window, { AddressTabs, ArticleTabs, DocumentTabs, AdminUsersView });
