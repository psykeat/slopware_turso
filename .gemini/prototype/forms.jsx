// EntityMask (create/edit form), Admin Users view, Shortcut overlay

const EntityMask = ({ mode = "create", values = {}, onSubmit, onCancel, focusField = "city" }) => {
  const v = values;
  return (
    <div className="mask">
      <div className="mask-card">
        <h2 className="mask-title">{mode === "create" ? "New Address" : "Edit Address"}</h2>
        <p className="mask-sub">{mode === "create" ? "Required fields are marked with an asterisk. Press F10 to save." : "Press F10 to save, Esc to cancel."}</p>

        <div className="mask-grid">
          <div className="form-row">
            <label className="form-label">Category<span className="req">*</span></label>
            <select className="input" defaultValue={v.category || "customers"}>
              <option value="customers">Customer</option>
              <option value="suppliers">Supplier</option>
              <option value="partners">Partner</option>
              <option value="prospects">Prospect</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Segment</label>
            <select className="input" defaultValue={v.segment || "Mid-Market"}>
              <option>Key Account</option>
              <option>Mid-Market</option>
              <option>SMB</option>
            </select>
          </div>

          <div className="form-row full">
            <label className="form-label">Company Name<span className="req">*</span></label>
            <input className="input" defaultValue={v.company || ""} placeholder="e.g. Vorwerk & Söhne GmbH"/>
          </div>

          <div className="form-row">
            <label className="form-label">Primary Contact<span className="req">*</span></label>
            <input className="input" defaultValue={v.contact || ""} placeholder="First Last"/>
          </div>
          <div className="form-row">
            <label className="form-label">Email</label>
            <input className="input" defaultValue={v.email || ""} placeholder="name@example.com"/>
            <span className="help-text">Used for invoice delivery and notifications.</span>
          </div>

          <div className="form-row full">
            <label className="form-label">Street<span className="req">*</span></label>
            <input className="input" defaultValue={v.street || ""} placeholder="Street and house number"/>
          </div>

          <div className="form-row">
            <label className="form-label">ZIP / Postal Code<span className="req">*</span></label>
            <input className="input" defaultValue={v.zip || ""} placeholder="e.g. 80539"/>
          </div>
          <div className="form-row">
            <label className="form-label">City<span className="req">*</span></label>
            <input className={"input" + (focusField === "city" ? " focused" : "")} autoFocus defaultValue={v.city || ""} placeholder="München"/>
          </div>

          <div className="form-row">
            <label className="form-label">Country<span className="req">*</span></label>
            <select className="input" defaultValue={v.country || "DE"}>
              <option value="DE">Germany (DE)</option>
              <option value="CH">Switzerland (CH)</option>
              <option value="AT">Austria (AT)</option>
              <option value="FR">France (FR)</option>
              <option value="IT">Italy (IT)</option>
              <option value="ES">Spain (ES)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="SE">Sweden (SE)</option>
              <option value="NO">Norway (NO)</option>
              <option value="DK">Denmark (DK)</option>
              <option value="FI">Finland (FI)</option>
              <option value="PL">Poland (PL)</option>
              <option value="IE">Ireland (IE)</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Phone</label>
            <input className="input error" defaultValue={v.phone || "+49 89"} placeholder="+49 …"/>
            <span className="error-text">Phone must include country code (e.g. +49 …).</span>
          </div>

          <div className="form-row">
            <label className="form-label">VAT ID / Tax ID</label>
            <input className="input" defaultValue={v.taxId || ""} placeholder="DE 814 552 901"/>
          </div>
          <div className="form-row">
            <label className="form-label">Currency<span className="req">*</span></label>
            <select className="input" defaultValue={v.currency || "EUR"}>
              <option>EUR</option><option>CHF</option><option>USD</option><option>GBP</option>
              <option>SEK</option><option>NOK</option><option>DKK</option><option>PLN</option>
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">Payment Terms</label>
            <select className="input" defaultValue={v.terms || "Net 30"}>
              <option>Net 14</option><option>Net 30</option><option>Net 45</option><option>Net 60</option>
              <option>Prepayment</option>
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Account Manager</label>
            <select className="input" defaultValue={v.manager || "K. Lindqvist"}>
              <option>K. Lindqvist</option><option>P. Okonkwo</option>
              <option>S. El-Amin</option><option>J. Wirth</option>
            </select>
          </div>

          <div className="form-row full">
            <label className="checkbox-row">
              <input type="checkbox" defaultChecked={v.active !== false}/>
              <span>Active — record participates in postings and reports.</span>
            </label>
          </div>
        </div>

        <div className="mask-footer">
          <button className="pillbtn" onClick={onCancel}>
            <span>Cancel</span>
            <span className="kbd">Esc</span>
          </button>
          <button className="pillbtn primary" onClick={onSubmit}>
            <Icon name="check" size={13}/>
            <span>{mode === "create" ? "Create" : "Update"}</span>
            <span className="kbd">F10</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ShortcutOverlay = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Icon name="keyboard" size={18} style={{ color: "var(--primary)" }}/>
          <h2 className="modal-title">Keyboard Shortcuts</h2>
          <span className="modal-sub">Press <span className="kbd">?</span> any time to open this</span>
          <button className="icon-btn modal-close" onClick={onClose}><Icon name="x" size={15}/></button>
        </div>
        <div className="modal-body">
          {SHORTCUTS.map((g, gi) => (
            <div key={gi} className="kbd-group">
              <div className="kbd-group-title">{g.group}</div>
              <div className="kbd-grid">
                {g.items.map((it, i) => (
                  <div key={i} className="kbd-row">
                    <span className="label">{it.label}</span>
                    <span className="kbd-combo">
                      {it.combo.map((k, ki) => (
                        <span key={ki} className="kbd" style={{ minWidth: 18, textAlign: "center" }}>{k}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { EntityMask, ShortcutOverlay });
