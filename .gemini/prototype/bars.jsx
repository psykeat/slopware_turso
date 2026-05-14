// Combined breadcrumb + action pill bar (top of workspace, 36px).
// Replaces the former separate ContextBar (crumbs) + ActionBar (pills) split.

const ActionBar = ({ crumbs = [], actions = [] }) => {
  return (
    <div className="actionbar">
      {crumbs.length > 0 && (
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Icon name="chevR" size={12} className="sep"/>}
              <span className={i === crumbs.length - 1 ? "crumb-active" : ""}>{c}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="actionbar-spacer"/>
      {actions.map((a, i) => (
        <button key={i}
                className={"pillbtn" + (a.primary ? " primary" : "") + (a.disabled ? " disabled" : "")}
                onClick={a.onClick}
                title={a.title || a.label}>
          {a.icon && <Icon name={a.icon} size={13}/>}
          <span>{a.label}</span>
          {a.kbd && <span className="kbd">{a.kbd}</span>}
        </button>
      ))}
    </div>
  );
};

const StatusBar = ({ tenant, module, record, online = true }) => {
  return (
    <div className="statusbar">
      <span className="meta">Tenant: <b>{tenant}</b></span>
      <span style={{ color: "var(--hairline-input)" }}>·</span>
      <span className="meta">Module: <b>{module}</b></span>
      {record && (
        <>
          <span style={{ color: "var(--hairline-input)" }}>·</span>
          <span className="meta">Record: <b className="t-mono">{record}</b></span>
        </>
      )}
      <div className="statusbar-right">
        <span className="meta" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>v4.12.0</span>
        <span style={{ color: "var(--hairline-input)" }}>·</span>
        <span className={"dot" + (online ? "" : " mute")}/>
        <span>{online ? "System Online" : "Offline"}</span>
      </div>
    </div>
  );
};

Object.assign(window, { ActionBar, StatusBar });
