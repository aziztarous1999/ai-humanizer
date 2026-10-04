import { CloseIcon } from "./icons.jsx";

// Messages shown above the editors: progress, retries, fallbacks and errors,
// optionally with action buttons ({ label, onClick }).
export function StatusBanner({ status, onDismiss }) {
  if (!status) return null;
  return (
    <div className="banner" data-kind={status.kind} role={status.kind === "error" ? "alert" : "status"}>
      <span className="banner-icon" aria-hidden="true" />
      <span className="banner-text">{status.msg}</span>
      {status.actions?.map((a) => (
        <button key={a.label} type="button" className="banner-action" onClick={a.onClick}>{a.label}</button>
      ))}
      <button className="icon-btn sm" type="button" onClick={onDismiss} aria-label="Dismiss message">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
