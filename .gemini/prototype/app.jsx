// Main slopware app — wires modules, demo states, keyboard, resize, Tweaks

// Themes — 10 palettes. The id maps to a [data-theme] attribute on <html>;
// CSS in tokens.css supplies the actual color values per mode.
const THEMES = [
  { id: "indigo",  label: "Indigo",  primary: "#533afd" },
  { id: "ocean",   label: "Ocean",   primary: "#2563eb" },
  { id: "cyan",    label: "Cyan",    primary: "#0e7490" },
  { id: "teal",    label: "Teal",    primary: "#0f766e" },
  { id: "emerald", label: "Emerald", primary: "#047857" },
  { id: "forest",  label: "Forest",  primary: "#4d7c0f" },
  { id: "amber",   label: "Amber",   primary: "#b45309" },
  { id: "rose",    label: "Rose",    primary: "#e11d48" },
  { id: "violet",  label: "Violet",  primary: "#7c3aed" },
  { id: "slate",   label: "Slate",   primary: "#475569" },
];
window.THEMES = THEMES;
const THEME_HEX_TO_ID = Object.fromEntries(THEMES.map(th => [th.primary, th.id]));
const THEME_LIST = THEMES;
const THEME_SWATCHES = Object.fromEntries(THEMES.map(th => [th.id, th.primary]));

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showStateBar": true,
  "isSystemAdmin": true,
  "lang": "EN",
  "sidebarTone": "indigo",
  "theme": "indigo",
  "mode": "light"
}/*EDITMODE-END*/;

// Resizable column helper
const useResize = (initial, min, max, axis = "x") => {
  const [size, setSize] = React.useState(initial);
  const startRef = React.useRef(null);
  const onMouseDown = (e) => {
    e.preventDefault();
    startRef.current = { v: axis === "x" ? e.clientX : e.clientY, size };
    const onMove = (ev) => {
      const pos = axis === "x" ? ev.clientX : ev.clientY;
      const delta = pos - startRef.current.v;
      const next = Math.max(min, Math.min(max, startRef.current.size + delta));
      setSize(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return [size, onMouseDown];
};

const MODULE_LABELS = {
  addresses: "Addresses",
  articles: "Articles",
  documents: "Documents",
  settings: "Settings",
  admin: "Administration",
  base: "Base Tenant",
};

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [module, setModule] = React.useState("addresses");
  const [demoState, setDemoState] = React.useState("default");
  // demo states: default | empty | loading | mask | admin | shortcut

  const [selectedCategory, setSelectedCategory] = React.useState("cust-key");
  const [selectedArticleGroup, setSelectedArticleGroup] = React.useState("hw-fast");
  const [selectedDocType, setSelectedDocType] = React.useState("sales-orders");

  const [selectedAddress, setSelectedAddress] = React.useState("AMS-00042");
  const [selectedArticle, setSelectedArticle] = React.useState("ART-100482");
  const [selectedDocument, setSelectedDocument] = React.useState("SO-2026-1042");

  const [showShortcuts, setShowShortcuts] = React.useState(false);

  const [treeW, treeDrag] = useResize(280, 200, 480, "x");
  const containerRef = React.useRef(null);
  const [gridH, setGridH] = React.useState(null); // null = use default 60%
  const onVDrag = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const rect = containerRef.current.getBoundingClientRect();
    const startH = gridH != null ? gridH : rect.height * 0.6;
    const onMove = (ev) => {
      const delta = ev.clientY - startY;
      const next = Math.max(140, Math.min(rect.height - 200, startH + delta));
      setGridH(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Sync demo state with module changes
  React.useEffect(() => {
    if (demoState === "shortcut") setShowShortcuts(true);
    else setShowShortcuts(false);
    if (demoState === "admin") setModule("admin");
    if (demoState === "empty") setModule("articles");
    if (demoState === "default" || demoState === "mask" || demoState === "loading") {
      if (module === "admin") setModule("addresses");
    }
  // eslint-disable-next-line
  }, [demoState]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (inField && e.key !== "Escape") return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setDemoState(d => d === "shortcut" ? "default" : "shortcut");
        return;
      }
      if (e.altKey && e.key === "1") { e.preventDefault(); setModule("addresses"); setDemoState("default"); return; }
      if (e.altKey && e.key === "2") { e.preventDefault(); setModule("articles"); setDemoState("default"); return; }
      if (e.altKey && e.key === "3") { e.preventDefault(); setModule("documents"); setDemoState("default"); return; }
      if (e.key === "F3") { e.preventDefault(); setDemoState("mask"); return; }
      if (e.key === "Escape") { setDemoState("default"); setShowShortcuts(false); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Apply mode + theme to <html>
  React.useEffect(() => {
    document.documentElement.dataset.mode = t.mode || "light";
    document.documentElement.dataset.theme = t.theme || "indigo";
  }, [t.mode, t.theme]);

  // Crumbs — module name lives in the AppBar tab, so we omit it here.
  const crumbs = (() => {
    if (module === "admin") return ["Users"];
    if (module === "settings") return ["General"];
    if (module === "base") return ["Overview"];
    if (module === "addresses") {
      const cat = ADDRESS_CATEGORIES.find(c => c.id === selectedCategory);
      const addr = ADDRESSES.find(a => a.id === selectedAddress);
      return [cat?.label, addr?.company].filter(Boolean);
    }
    if (module === "articles") {
      const grp = ARTICLE_GROUPS.find(g => g.id === selectedArticleGroup);
      const a = ARTICLES.find(x => x.id === selectedArticle);
      return [grp?.label, demoState === "empty" ? null : a?.id].filter(Boolean);
    }
    if (module === "documents") {
      const grp = DOCUMENT_TYPES.find(g => g.id === selectedDocType);
      const d = DOCUMENTS.find(x => x.id === selectedDocument);
      return [grp?.label, d?.no].filter(Boolean);
    }
    return [];
  })();

  // Actions per module
  const actions = (() => {
    const base = module === "admin"
      ? [
          { label: "New User", icon: "plus", kbd: "F3", primary: true, onClick: () => setDemoState("mask") },
          { label: "Edit", icon: "edit", kbd: "F2" },
          { label: "Suspend", icon: "archive", kbd: "F4" },
          { label: "Reset Password", icon: "refresh" },
          { label: "Invite", icon: "send" },
        ]
      : module === "documents"
      ? [
          { label: "New", icon: "plus", kbd: "F3", primary: true, onClick: () => setDemoState("mask") },
          { label: "Edit", icon: "edit", kbd: "F2" },
          { label: "Duplicate", icon: "copy", kbd: "F8" },
          { label: "Post", icon: "check", kbd: "F9" },
          { label: "Archive", icon: "archive", kbd: "F4" },
          { label: "Send", icon: "send" },
        ]
      : module === "articles"
      ? [
          { label: "New", icon: "plus", kbd: "F3", primary: true, onClick: () => setDemoState("mask") },
          { label: "Edit", icon: "edit", kbd: "F2" },
          { label: "Duplicate", icon: "copy", kbd: "F8" },
          { label: "Archive", icon: "archive", kbd: "F4" },
          { label: "Stock Take", icon: "box" },
        ]
      : [
          { label: "New", icon: "plus", kbd: "F3", primary: true, onClick: () => setDemoState("mask") },
          { label: "Edit", icon: "edit", kbd: "F2" },
          { label: "Archive", icon: "archive", kbd: "F4" },
          { label: "Duplicate", icon: "copy", kbd: "F8" },
          { label: "Post", icon: "check", kbd: "F9", disabled: true },
        ];
    if (demoState === "mask") {
      return base.map(b => ({ ...b, disabled: true }));
    }
    return base;
  })();

  const statusRecord = (() => {
    if (module === "addresses") return selectedAddress;
    if (module === "articles") return demoState === "empty" ? null : selectedArticle;
    if (module === "documents") return selectedDocument;
    if (module === "admin") return "U-0001";
    return null;
  })();

  // Render module content
  const renderWorkspace = () => {
    if (module === "admin") return <AdminUsersView/>;
    if (module === "settings" || module === "base") {
      return (
        <div className="workspace" style={{ alignItems: "center", justifyContent: "center", color: "var(--ink-mute)", flexDirection: "column", gap: 8 }}>
          <Icon name={module === "settings" ? "gear" : "globe"} size={28} stroke={1.2}/>
          <div style={{ fontSize: 15 }}>{MODULE_LABELS[module]} workspace placeholder</div>
        </div>
      );
    }

    // TriView modules
    const loading = demoState === "loading";
    const isEmpty = demoState === "empty" && module === "articles";
    const showMask = demoState === "mask";

    let tree, grid, lower;
    if (module === "addresses") {
      const row = ADDRESSES.find(a => a.id === selectedAddress) || ADDRESSES[0];
      tree = <NavigationTree header="Categories" loading={loading} nodes={ADDRESS_CATEGORIES} selected={selectedCategory} onSelect={setSelectedCategory}/>;
      grid = (
        <DataGrid
          title="Key Accounts"
          count={ADDRESSES.length}
          loading={loading}
          selected={selectedAddress}
          onSelect={setSelectedAddress}
          columns={[
            { key: "id", label: "Address No.", width: 120, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.id}</span> },
            { key: "company", label: "Company", width: 280 },
            { key: "contact", label: "Primary Contact", width: 180 },
            { key: "city", label: "City", width: 140 },
            { key: "country", label: "Country", width: 90 },
            { key: "phone", label: "Phone", width: 170, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.phone}</span> },
            { key: "segment", label: "Segment", width: 130 },
          ]}
          rows={ADDRESSES}
        />
      );
      lower = <AddressTabs row={row} openMask={showMask}/>;
    } else if (module === "articles") {
      const row = ARTICLES.find(a => a.id === selectedArticle) || ARTICLES[0];
      tree = <NavigationTree header="Article Groups" loading={loading} nodes={ARTICLE_GROUPS} selected={isEmpty ? "empty" : selectedArticleGroup} onSelect={(id) => { setSelectedArticleGroup(id); if (id === "empty") setDemoState("empty"); else setDemoState("default"); }}/>;
      grid = (
        <DataGrid
          title={isEmpty ? "Custom Fabrication" : "Fasteners"}
          count={isEmpty ? 0 : ARTICLES.length}
          loading={loading}
          selected={selectedArticle}
          onSelect={setSelectedArticle}
          empty={{
            title: "No articles in this group.",
            subtitle: "This group has no entries yet. Create one to get started.",
            action: { label: "New Article", kbd: "F3", onClick: () => setDemoState("mask") },
          }}
          columns={[
            { key: "id", label: "Article No.", width: 120, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.id}</span> },
            { key: "name", label: "Name" },
            { key: "unit", label: "Unit", width: 70 },
            { key: "price", label: "Price", num: true, width: 110, render: r => <span className="tnum">{r.currency} {r.price.toFixed(2)}</span> },
            { key: "stock", label: "Stock", num: true, width: 100, render: r => <span className="tnum">{r.stock.toLocaleString()}</span> },
            { key: "location", label: "Location", width: 100, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.location}</span> },
          ]}
          rows={isEmpty ? [] : ARTICLES}
        />
      );
      lower = isEmpty
        ? (
          <div className="lower-pane">
            <div className="tabs"><div className="tab active">Details</div><div className="tab">Inventory Movements</div></div>
            <div className="inspector"><div className="tab-content-empty">Select an article to see its details.</div></div>
          </div>
        )
        : <ArticleTabs row={row}/>;
    } else {
      const row = DOCUMENTS.find(a => a.id === selectedDocument) || DOCUMENTS[0];
      tree = <NavigationTree header="Document Types" loading={loading} nodes={DOCUMENT_TYPES} selected={selectedDocType} onSelect={setSelectedDocType}/>;
      grid = (
        <DataGrid
          title="Sales Orders"
          count={DOCUMENTS.length}
          loading={loading}
          selected={selectedDocument}
          onSelect={setSelectedDocument}
          columns={[
            { key: "no", label: "No.", width: 150, render: r => <span className="t-mono" style={{ fontSize: 13 }}>{r.no}</span> },
            { key: "date", label: "Date", width: 110, render: r => <span className="tnum">{r.date}</span> },
            { key: "customer", label: "Customer" },
            { key: "lines", label: "Lines", num: true, width: 70, render: r => <span className="tnum">{r.lines}</span> },
            { key: "total", label: "Total", num: true, width: 150, render: r => <span className="tnum">{formatMoney(r.total, r.currency)}</span> },
            { key: "status", label: "Status", width: 120, render: r => (
              <span className="status-cell" style={{ color: r.status === "Posted" || r.status === "Open" ? "var(--ink)" : "var(--ink-mute)" }}>
                <span className={"dot " + (r.status === "Posted" ? "" : r.status === "Open" ? "warn" : "mute")}/>{r.status}
              </span>
            )},
          ]}
          rows={DOCUMENTS}
        />
      );
      lower = <DocumentTabs row={row}/>;
    }

    return (
      <div className="workspace" ref={containerRef}>
        <div className="triview" style={{ "--tree-w": treeW + "px" }}>
          {tree}
          <div className="resize-h" onMouseDown={treeDrag}><div className="grip"/></div>
          <div className="triview-right" style={{ "--grid-h": gridH != null ? gridH + "px" : "60%" }}>
            {grid}
            <div className="resize-v" onMouseDown={onVDrag}><div className="grip"/></div>
            {lower}
          </div>
        </div>
      </div>
    );
  };

  const states = [
    { id: "default", label: "Default" },
    { id: "empty", label: "Empty Grid" },
    { id: "loading", label: "Loading" },
    { id: "mask", label: "Create Form" },
    { id: "admin", label: "Admin View" },
    { id: "shortcut", label: "Shortcuts ?" },
  ];

  return (
    <>
      {t.showStateBar && (
        <div className="state-bar">
          {states.map(s => (
            <button key={s.id} className={demoState === s.id ? "on" : ""} onClick={() => setDemoState(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="app">
        <AppBar module={module}
                onModuleChange={(m) => { setModule(m); if (demoState === "admin" && m !== "admin") setDemoState("default"); if (m === "admin") setDemoState("admin"); }}
                lang={t.lang}
                onLang={(l) => setTweak("lang", l)}
                mode={t.mode}
                onMode={(m) => setTweak("mode", m)}
                theme={t.theme || "indigo"}
                onTheme={(th) => setTweak("theme", th)}
                onHelp={() => setDemoState("shortcut")}
                isSystemAdmin={t.isSystemAdmin}
                tenantId={t.tenant || "acme"}
                onTenantChange={(id) => setTweak("tenant", id)}/>
        <div className="main-col">
          <ActionBar crumbs={crumbs} actions={actions}/>
          {renderWorkspace()}
          <StatusBar tenant="Acme Corp"
                     module={MODULE_LABELS[module]}
                     record={statusRecord}/>
        </div>
      </div>

      <ShortcutOverlay open={showShortcuts || demoState === "shortcut"} onClose={() => { setShowShortcuts(false); setDemoState("default"); }}/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance"/>
        <TweakRadio label="Mode" value={t.mode || "light"} options={[{ value: "light", label: "Day" }, { value: "dark", label: "Night" }]} onChange={(v) => setTweak("mode", v)}/>
        <TweakColor label="Theme" value={THEME_SWATCHES[t.theme || "indigo"]}
                    options={THEMES.map(th => th.primary)}
                    onChange={(hex) => { const id = THEME_HEX_TO_ID[hex]; if (id) setTweak("theme", id); }}/>
        <TweakSelect label="Theme name" value={t.theme || "indigo"}
                     options={THEME_LIST.map(th => ({ value: th.id, label: th.label }))}
                     onChange={(v) => setTweak("theme", v)}/>

        <TweakSection label="Demo State"/>
        <TweakSelect label="State" value={demoState} options={states.map(s => ({ value: s.id, label: s.label }))} onChange={setDemoState}/>
        <TweakToggle label="State Switcher Bar" value={t.showStateBar} onChange={(v) => setTweak("showStateBar", v)}/>

        <TweakSection label="Module"/>
        <TweakSelect label="Active Module"
                     value={module}
                     options={[
                       { value: "addresses", label: "Addresses" },
                       { value: "articles", label: "Articles" },
                       { value: "documents", label: "Documents" },
                       { value: "admin", label: "Administration" },
                       { value: "settings", label: "Settings" },
                     ]}
                     onChange={setModule}/>

        <TweakSection label="Shell"/>
        <TweakToggle label="System admin role" value={t.isSystemAdmin} onChange={(v) => setTweak("isSystemAdmin", v)}/>
        <TweakRadio label="Language" value={t.lang} options={["EN", "DE"]} onChange={(v) => setTweak("lang", v)}/>
      </TweaksPanel>
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
