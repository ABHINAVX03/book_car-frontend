import { FiClock, FiHeadphones, FiMail, FiPhoneCall } from "react-icons/fi";
import {
  SUPPORT_CONTACT,
  getSupportCallHref,
  getSupportMailHref,
} from "../constants/support";

export default function SupportPanel({
  contextLabel = "my ride",
  title = "Need help right now?",
  description = "Reach BookCar support from one place instead of searching for a number.",
  compact = false,
}) {
  return (
    <div className={`card premium-card ${compact ? "support-panel-compact" : "support-panel"}`}>
      <div className="support-panel-copy">
        <div className="support-panel-eyebrow">
          <FiHeadphones />
          BookCar support
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="support-panel-meta">
        <div className="support-meta-chip">
          <FiPhoneCall />
          {SUPPORT_CONTACT.phoneDisplay}
        </div>
        <div className="support-meta-chip">
          <FiClock />
          {SUPPORT_CONTACT.hours}
        </div>
      </div>

      <div className="support-action-grid">
        <a className="btn btn-dark" href={getSupportCallHref()}>
          <FiPhoneCall />
          Call support
        </a>
        <a className="btn btn-ghost" href={getSupportMailHref(contextLabel)}>
          <FiMail />
          Email
        </a>
      </div>

      <div className="support-panel-note">{SUPPORT_CONTACT.sla}</div>
    </div>
  );
}
