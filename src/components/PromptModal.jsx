import { useState, useEffect } from "react";
import { X } from "lucide-react";

/**
 * Generic replacement for window.confirm() / window.prompt().
 *
 * type="confirm" -> message + Confirm/Cancel
 * type="text" | "password" | "number" -> label + input + Save/Cancel
 * type="select" -> label + dropdown (options: string[]) + Save/Cancel
 * type="multiselect" -> label + checkbox list (options: string[]) - value is a
 *                        comma-separated string of the selected options
 */
export default function PromptModal({
  open, title, message, type = "confirm", label, initialValue = "",
  options = [], optionLabels = null, placeholder, danger, confirmLabel, cancelLabel,
  onSubmit, onCancel,
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const selectedList = type === "multiselect"
    ? (value || "").split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const toggleOption = (opt) => {
    const next = selectedList.includes(opt)
      ? selectedList.filter((o) => o !== opt)
      : [...selectedList, opt];
    setValue(next.join(", "));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSubmit(type === "confirm" ? true : value);
  };

  return (
    <div className="overlay modal-overlay" onClick={onCancel}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onCancel}><X size={18} /></button>
        <h3>{title}</h3>

        <form onSubmit={handleSubmit}>
          {type === "confirm" && message && <p className="prompt-message">{message}</p>}

          {(type === "text" || type === "password" || type === "number") && (
            <>
              {label && <label>{label}</label>}
              <input
                type={type}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                autoFocus
              />
            </>
          )}

          {type === "select" && (
            <>
              {label && <label>{label}</label>}
              <select value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
                <option value="">{placeholder || "—"}</option>
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </>
          )}

          {type === "multiselect" && (
            <>
              {label && <label>{label}</label>}
              <div className="multiselect-list">
                {options.length === 0 && <p className="prompt-message">—</p>}
                {options.map((o) => (
                  <label key={o} className="multiselect-item">
                    <input
                      type="checkbox"
                      checked={selectedList.includes(o)}
                      onChange={() => toggleOption(o)}
                    />
                    {optionLabels?.[o] || o}
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="prompt-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {cancelLabel || "Cancel"}
            </button>
            <button type="submit" className={`btn-primary ${danger ? "danger-btn" : ""}`}>
              {confirmLabel || "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
