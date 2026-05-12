import { FiAlertCircle, FiClock, FiMail, FiPhoneCall, FiShield } from "react-icons/fi";
import SupportPanel from "../components/SupportPanel";

const supportReasons = [
  {
    icon: FiAlertCircle,
    title: "Active ride emergency",
    description: "Call immediately if a trip feels unsafe, a driver cannot be reached, or pickup details are wrong.",
  },
  {
    icon: FiMail,
    title: "Booking and wallet help",
    description: "Use email for fare questions, payment issues, refunds, and booking follow-ups.",
  },
  {
    icon: FiShield,
    title: "Account and profile support",
    description: "Get help updating your phone number, role access, or driver onboarding details.",
  },
];

export default function SupportPage() {
  return (
    <div className="fade-in">
      <div className="premium-hero-panel" style={{ background: "var(--chrome-bg)", padding: "2.5rem 1.5rem 4.5rem", position: "relative", overflow: "hidden" }}>
        <div className="animated-grid" />
        <div className="app-orb" style={{ top: -60, right: -20, width: 260, height: 260, background: "var(--brand)" }} />
        <div className="page-wrap">
          <span className="badge badge-yellow" style={{ marginBottom: "0.75rem" }}>
            Support
          </span>
          <h1 style={{ color: "#fff", fontSize: "2rem", letterSpacing: "-1px" }}>Phone support that is always easy to find</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", marginTop: "0.75rem", maxWidth: 620 }}>
            One professional support line, clear response expectations, and working contact actions across the full rider and driver journey.
          </p>
        </div>
      </div>

      <div className="app-shell-content">
        <div className="page-wrap">
          <SupportPanel
            contextLabel="my current BookCar issue"
            title="Speak to BookCar support"
            description="Call or email BookCar support from this page. The same support number is now reused across the app."
          />

          <div className="support-reason-grid" style={{ marginTop: "1.5rem" }}>
            {supportReasons.map(({ icon: Icon, title, description }) => (
              <div key={title} className="card premium-card support-reason-card">
                <div className="feature-icon">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>

          <div className="card premium-card" style={{ marginTop: "1.5rem" }}>
            <div className="section-heading-copy">
              <h3>What happens when you contact support</h3>
              <p>Trips in progress should be called in. Everything else can start by email and will still be tracked properly.</p>
            </div>
            <div className="support-timeline">
              <div className="support-timeline-item">
                <FiPhoneCall />
                <span>Call for urgent ride issues, pickup problems, or safety concerns.</span>
              </div>
              <div className="support-timeline-item">
                <FiMail />
                <span>Email for ride history, fare corrections, wallet follow-ups, and account support.</span>
              </div>
              <div className="support-timeline-item">
                <FiClock />
                <span>Expect the fastest response during active rides, with the support line available 24/7.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
