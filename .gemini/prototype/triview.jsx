// TriView core components: NavigationTree, DataGrid, ContextTabs, InspectorPanel

const formatMoney = (v, currency = "EUR") => {
  const parts = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${parts}`;
};

const NavigationTree = ({ nodes, selected, onSelect, loading = false, header = "Categories" }) => {
  if (loading) {
    return (
      <div className="tree">
        <div className="tree-header">{header}</div>
        <div className="tree-list">
          {[0, 14, 6, 22, 14, 6, 0].map((indent, i) => (
            <div key={i} className="tree-node" style={{ paddingLeft: 8 + indent + 12 }}>
              <div className="sk" style={{ width: 14, height: 14, marginRight: 8 }}/>
              <div className="sk" style={{ height: 10, width: 80 + (i * 13) % 60 }}/>
              <div className="sk" style={{ height: 8, width: 22, marginLeft: "auto" }}/>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="tree">
      <div className="tree-header">{header}</div>
      <div className="tree-list">
        {nodes.map(n => {
          // Hide nodes whose ancestor is closed
          const isActive = selected === n.id;
          return (
            <div key={n.id}
                 className={"tree-node" + (isActive ? " active" : "")}
                 style={{ paddingLeft: 8 + n.level * 14 }}
                 onClick={() => onSelect && onSelect(n.id)}>
              <span className="tree-chev">
                {n.level === 0 || (n.open !== undefined) ? <Icon name={n.open ? "chevDown" : "chevR"} size={12} stroke={1.5}/> : <span style={{ width: 12 }}/>}
              </span>
              <span className="tree-icon">
                <Icon name={n.open ? "folderOpen" : n.icon || "folder"} size={13} stroke={1.4}/>
              </span>
              <span>{n.label}</span>
              <span className="tree-count">{n.count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DataGrid = ({ columns, rows, selected, onSelect, loading = false, title, count, empty, toolbar = true }) => {
  return (
    <div className="grid-wrap">
      {toolbar && (
        <div className="grid-toolbar">
          <span className="grid-title">{title}</span>
          <span className="grid-meta">{count != null ? `${count.toLocaleString()} records` : ""}</span>
          <div style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
            <button className="icon-btn" title="Filter"><Icon name="filter" size={14}/></button>
            <button className="icon-btn" title="Refresh"><Icon name="refresh" size={14}/></button>
            <button className="icon-btn" title="Export"><Icon name="download" size={14}/></button>
            <button className="icon-btn" title="More"><Icon name="more" size={14}/></button>
          </div>
        </div>
      )}
      <div className="grid-scroll">
        {loading ? (
          <table className="grid">
            <thead>
              <tr>{columns.map((c, i) => <th key={i} className={c.num ? "num" : ""} style={{ width: c.width }}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, r) => (
                <tr key={r}>
                  {columns.map((c, i) => (
                    <td key={i} className={c.num ? "num" : ""}>
                      <div className="sk" style={{ height: 10, width: c.num ? 60 : 100 + (i * 23 + r * 17) % 80 }}/>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : rows.length === 0 ? (
          <div className="grid-empty">
            <div className="icon-ring"><Icon name="inbox" size={22} stroke={1.2}/></div>
            <div style={{ color: "var(--ink-secondary)", fontSize: 14 }}>{empty?.title || "No results."}</div>
            <div style={{ fontSize: 12 }}>{empty?.subtitle || "Try a different filter, or create a new record."}</div>
            {empty?.action && (
              <button className="pillbtn primary" style={{ marginTop: 12 }} onClick={empty.action.onClick}>
                <Icon name="plus" size={13}/>{empty.action.label}
                {empty.action.kbd && <span className="kbd">{empty.action.kbd}</span>}
              </button>
            )}
          </div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={i} className={c.num ? "num" : ""} style={{ width: c.width }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={row.id || r}
                    className={selected === row.id ? "selected" : ""}
                    onClick={() => onSelect && onSelect(row.id)}>
                  {columns.map((c, i) => (
                    <td key={i} className={c.num ? "num" : ""} style={{ width: c.width }}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const ContextTabs = ({ tabs, active, onChange, children }) => {
  return (
    <div className="lower-pane">
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id}
               className={"tab" + (active === t.id ? " active" : "")}
               onClick={() => onChange && onChange(t.id)}>
            {t.label}
            {t.count != null && <span className="tab-count">{t.count}</span>}
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, paddingRight: 4 }}>
          <button className="icon-btn" title="Open in new window"><Icon name="more" size={14}/></button>
        </div>
      </div>
      <div className="inspector">{children}</div>
    </div>
  );
};

const InspectorPanel = ({ title, id, fields, sections, actions }) => {
  return (
    <>
      <div className="insp-header">
        <span>{title}</span>
        {id && <span className="insp-id">{id}</span>}
        <div className="insp-actions">
          {actions || (
            <>
              <button className="icon-btn" title="Edit"><Icon name="edit" size={14}/></button>
              <button className="icon-btn" title="More"><Icon name="more" size={14}/></button>
            </>
          )}
        </div>
      </div>
      <div className="insp-body">
        {sections ? sections.map((s, si) => (
          <React.Fragment key={si}>
            <div className="insp-section">{s.title}</div>
            {s.fields.map((f, fi) => (
              <div key={fi} className="field-row" style={f.full ? { gridColumn: "1 / -1" } : null}>
                <div className="field-label">{f.label}</div>
                <div className={"field-value" + (f.mono ? " mono" : "")}>{f.value || <span className="muted">—</span>}</div>
              </div>
            ))}
          </React.Fragment>
        )) : (fields || []).map((f, i) => (
          <div key={i} className="field-row" style={f.full ? { gridColumn: "1 / -1" } : null}>
            <div className="field-label">{f.label}</div>
            <div className={"field-value" + (f.mono ? " mono" : "")}>{f.value || <span className="muted">—</span>}</div>
          </div>
        ))}
      </div>
    </>
  );
};

Object.assign(window, { NavigationTree, DataGrid, ContextTabs, InspectorPanel, formatMoney });
