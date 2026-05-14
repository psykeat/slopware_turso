// Top app bar — replaces the dark sidebar.
// Houses: brand mark, tenant switcher, primary module tabs, system overflow,
// search, language/mode/help, and the user avatar dropdown.

const PRIMARY_MODULES = [
  { id: "addresses", label: "Addresses", icon: "user", kbd: "⌥1" },
  { id: "articles", label: "Articles", icon: "package", kbd: "⌥2" },
  { id: "documents", label: "Documents", icon: "file", kbd: "⌥3" },
];

const SYSTEM_MODULES = [
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "admin", label: "Administration", icon: "shield", adminOnly: true },
  { id: "base", label: "Base Tenant", icon: "globe", adminOnly: true, special: true },
];

const TENANTS = [
  { id: "acme", org: "Acme Group", name: "Acme Corp", color: "#533afd" },
  { id: "acme-de", org: "Acme Group", name: "Acme DE GmbH", color: "#0f766e" },
  { id: "acme-uk", org: "Acme Group", name: "Acme UK Ltd", color: "#b45309" },
  { id: "northwind", org: "Northwind Holding", name: "Northwind Trading", color: "#e11d48" },
];

const useDismiss = (open, setOpen, selector) => {
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!e.target.closest(selector)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("click", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);
};

const TenantSwitcher = ({ tenantId, onChange }) => {
  const [open, setOpen] = React.useState(false);
  useDismiss(open, setOpen, ".tenant-wrap");
  const active = TENANTS.find(t => t.id === tenantId) || TENANTS[0];
  return (
    <div className="tenant-wrap">
      <button className={"tenant-pill" + (open ? " open" : "")} onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}>
        <span className="tenant-dot" style={{ background: active.color }}/>
        <span className="tenant-pill-text">
          <span className="tenant-pill-org">{active.org}</span>
          <span className="tenant-pill-name">{active.name}</span>
        </span>
        <Icon name="chevDown" size={12} className="tenant-pill-chev"/>
      </button>
      {open && (
        <div className="tenant-menu">
          <div className="tenant-menu-header">Switch Tenant</div>
          {TENANTS.map(t => (
            <div key={t.id} className={"tenant-menu-item" + (t.id === active.id ? " active" : "")}
                 onClick={() => { onChange && onChange(t.id); setOpen(false); }}>
              <span className="tenant-dot" style={{ background: t.color }}/>
              <span className="tenant-menu-text">
                <span className="tenant-menu-org">{t.org}</span>
                <span className="tenant-menu-name">{t.name}</span>
              </span>
              {t.id === active.id && <Icon name="check" size={14} stroke={1.8}/>}
            </div>
          ))}
          <div className="tenant-menu-sep"/>
          <div className="tenant-menu-item subtle">
            <Icon name="plus" size={13}/>
            <span>New Tenant…</span>
          </div>
        </div>
      )}
    </div>
  );
};

const SystemOverflow = ({ module, onModuleChange, isSystemAdmin }) => {
  const [open, setOpen] = React.useState(false);
  useDismiss(open, setOpen, ".sysmenu-wrap");
  const items = SYSTEM_MODULES.filter(m => !m.adminOnly || isSystemAdmin);
  const isOnSystem = items.some(i => i.id === module);
  return (
    <div className="sysmenu-wrap">
      <button className={"module-overflow" + (isOnSystem ? " active" : "") + (open ? " open" : "")}
              onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
              title="System">
        <Icon name="more" size={14}/>
      </button>
      {open && (
        <div className="sysmenu">
          <div className="sysmenu-label">System</div>
          {items.map(m => (
            <div key={m.id} className={"sysmenu-item" + (module === m.id ? " active" : "") + (m.special ? " special" : "")}
                 onClick={() => { onModuleChange && onModuleChange(m.id); setOpen(false); }}>
              <Icon name={m.icon} size={14}/>
              <span>{m.label}</span>
              {module === m.id && <Icon name="check" size={13} stroke={1.8} style={{ marginLeft: "auto" }}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AvatarMenu = ({ lang, onLang, mode, onMode, theme, onTheme }) => {
  const [open, setOpen] = React.useState(false);
  useDismiss(open, setOpen, ".avatar-menu-wrap");
  const themes = window.THEMES || [];
  return (
    <div className="avatar-menu-wrap" style={{ position: "relative" }}>
      <div className="avatar-sm" title="Karin Lindqvist"
           onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
           style={{ cursor: "default" }}>K</div>
      {open && (
        <div className="avatar-menu wide" onClick={e => e.stopPropagation()}>
          <div className="avatar-menu-head">
            <div className="avatar-menu-name">Karin Lindqvist</div>
            <div className="avatar-menu-email">karin.lindqvist@acme.io</div>
          </div>
          <div className="avatar-menu-item">User Config</div>
          <div className="avatar-menu-item">
            <span>Language</span>
            <div className="lang-toggle light">
              <button className={lang === "DE" ? "on" : ""} onClick={() => onLang && onLang("DE")}>DE</button>
              <button className={lang === "EN" ? "on" : ""} onClick={() => onLang && onLang("EN")}>EN</button>
            </div>
          </div>
          <div className="avatar-menu-item">
            <span>Appearance</span>
            <div className="lang-toggle light">
              <button className={mode !== "dark" ? "on" : ""} onClick={() => onMode && onMode("light")}>Day</button>
              <button className={mode === "dark" ? "on" : ""} onClick={() => onMode && onMode("dark")}>Night</button>
            </div>
          </div>
          {themes.length > 0 && (
            <div className="avatar-menu-block">
              <div className="avatar-menu-label">Theme</div>
              <div className="theme-swatches">
                {themes.map(th => (
                  <button key={th.id}
                          className={"theme-swatch" + (theme === th.id ? " active" : "")}
                          title={th.label}
                          style={{ background: th.primary }}
                          onClick={() => onTheme && onTheme(th.id)}>
                    {theme === th.id && <Icon name="check" size={12} stroke={2.2}/>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="avatar-menu-sep"/>
          <div className="avatar-menu-item danger">
            <span>Sign Out</span>
            <span className="kbd" style={{ marginLeft: "auto" }}>⌘⇧Q</span>
          </div>
        </div>
      )}
    </div>
  );
};

const AppBar = ({ module, onModuleChange, lang, onLang, mode, onMode, theme, onTheme, onHelp, isSystemAdmin, tenantId, onTenantChange }) => {
  return (
    <header className="appbar">
      <div className="appbar-brand">
        <div className="brand-mark">◇</div>
        <div className="brand-word">slopware</div>
      </div>

      <div className="appbar-divider"/>

      <TenantSwitcher tenantId={tenantId} onChange={onTenantChange}/>

      <div className="appbar-divider"/>

      <nav className="module-tabs">
        {PRIMARY_MODULES.map(m => (
          <button key={m.id}
                  className={"module-tab" + (module === m.id ? " active" : "")}
                  onClick={() => onModuleChange && onModuleChange(m.id)}
                  title={`${m.label} (${m.kbd})`}>
            <Icon name={m.icon} size={14} stroke={1.6}/>
            <span>{m.label}</span>
            <span className="kbd">{m.kbd}</span>
          </button>
        ))}
        <SystemOverflow module={module} onModuleChange={onModuleChange} isSystemAdmin={isSystemAdmin}/>
      </nav>

      <div className="appbar-search">
        <Icon name="search" size={13}/>
        <span>Search records, articles, documents…</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
          <span className="kbd" style={{ fontSize: 9, padding: "0 4px" }}>⌘</span>
          <span className="kbd" style={{ fontSize: 9, padding: "0 4px" }}>K</span>
        </span>
      </div>

      <div className="appbar-right">
        <button className="icon-btn" title="Keyboard shortcuts (?)" onClick={onHelp}>
          <Icon name="help" size={15}/>
        </button>
        <AvatarMenu lang={lang} onLang={onLang} mode={mode} onMode={onMode} theme={theme} onTheme={onTheme}/>
      </div>
    </header>
  );
};

Object.assign(window, { AppBar, TENANTS, PRIMARY_MODULES, SYSTEM_MODULES });
