import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiClock, FiMapPin, FiShield, FiStar, FiZap } from "react-icons/fi";
import { SUPPORT_CONTACT, getSupportCallHref } from "../constants/support";

const featureCards = [
  { icon: FiZap, title: 'Instant Matching', desc: 'Get paired with a nearby driver in under a minute.' },
  { icon: FiShield, title: 'Verified Drivers', desc: 'Every driver is checked, rated, and visible before pickup.' },
  { icon: FiClock, title: 'Transparent Timing', desc: 'Know when your ride arrives and how long your trip will take.' },
  { icon: FiMapPin, title: 'Live Journey Tracking', desc: 'Stay informed from pickup to final drop-off with cleaner trip updates.' },
];

const journeySteps = [
  { id: "01", title: "Choose your route", desc: "Pick your pickup point, destination, and payment method in a few taps." },
  { id: "02", title: "Match with a driver", desc: "We surface a nearby driver and keep ride updates visible while you wait." },
  { id: "03", title: "Track the full trip", desc: "From confirmation to drop-off, everything stays organized in one place." },
];

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="fade-in">
      <section className="home-hero">
        <div className="home-hero-orb home-hero-orb-1 animate-float-shape" />
        <div className="home-hero-orb home-hero-orb-2 animate-float-shape delay-500" />

        <div className="page-wrap home-hero-grid">
          <div className="home-hero-copy">
            <div className="badge badge-yellow animate-fade-up" style={{ marginBottom: '1.5rem' }}>
              Premium city travel, simplified
            </div>
            <h1 className="animate-fade-up delay-100 home-hero-title">
              Book faster.
              <br />
              <span>Ride calmer.</span>
            </h1>
            <p className="animate-fade-up delay-200 home-hero-text">
              BookCar gives riders a cleaner booking flow, better visibility, and a more trustworthy driver experience from the first tap to final drop.
            </p>
            <div className="animate-fade-up delay-300" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: '1rem' }}>
              <button className="btn btn-primary btn-lg hover-scale btn-premium" style={{ padding: '16px 36px' }} onClick={() => navigate('/signup')}>
                Get started free <FiArrowRight />
              </button>
              <button className="btn btn-ghost btn-lg hover-scale" style={{ borderColor: 'var(--nav-border)', color: 'var(--nav-muted)', padding: '16px 36px' }}
                onClick={() => navigate('/login')}>
                Sign in →
              </button>
            </div>

            <div className="home-trust-strip animate-fade-up delay-400">
              <div>
                <strong>2,400+</strong>
                <span>active drivers</span>
              </div>
              <div>
                <strong>8,100+</strong>
                <span>rides today</span>
              </div>
              <div>
                <strong>4.8/5</strong>
                <span>average rider rating</span>
              </div>
            </div>
          </div>

          <div className="home-hero-panel glass-panel animate-fade-up delay-400">
            <div className="home-panel-chip">
              <FiStar />
              Seamless booking preview
            </div>
            <div className="home-ride-card">
              <div className="home-ride-row">
                <span className="route-dot dot-pickup" />
                <div>
                  <div className="summary-label">Pickup</div>
                  <div className="summary-value">Airport Terminal 3</div>
                </div>
              </div>
              <div className="route-line home-route-line" />
              <div className="home-ride-row">
                <span className="route-dot dot-drop" />
                <div>
                  <div className="summary-label">Dropoff</div>
                  <div className="summary-value">Cyber Hub, Gurgaon</div>
                </div>
              </div>
            </div>
            <div className="book-ride-summary">
              <div className="summary-tile">
                <span className="summary-label">ETA</span>
                <span className="summary-value">4 min</span>
              </div>
              <div className="summary-tile">
                <span className="summary-label">Payment</span>
                <span className="summary-value">Wallet</span>
              </div>
              <div className="summary-tile">
                <span className="summary-label">Estimated fare</span>
                <span className="summary-value">₹420</span>
              </div>
            </div>
            <div className="home-driver-card">
              <div className="home-driver-avatar">RK</div>
              <div>
                <div className="summary-value">Rohit Kumar</div>
                <div className="summary-label">Verified driver • 4.9 rating</div>
              </div>
              <span className="badge badge-yellow">Live</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-marquee">
        <div className="page-wrap home-marquee-grid">
          <span>Fast pickup dispatch</span>
          <span>Cleaner rider dashboard</span>
          <span>Driver status visibility</span>
          <span>Wallet and cash support</span>
        </div>
      </section>

      <section style={{ padding: '6rem 1.5rem', background: 'var(--surface)' }}>
        <div className="page-wrap">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '2.8rem', letterSpacing: '-1.5px', marginBottom: '0.75rem' }}>
              Why choose BookCar?
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '1.05rem' }}>
              Everything you need for a smooth, safe journey
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {featureCards.map((feature, i) => {
              const Icon = feature.icon;
              return (
              <div key={feature.title} className={`card hover-lift animate-fade-up delay-${i * 100} premium-card`} style={{ padding: '2.5rem 2rem', border: '1px solid var(--surface-2)' }}>
                <div className="feature-icon">
                  <Icon />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', letterSpacing: '-0.3px' }}>{feature.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.7 }}>{feature.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      <section className="home-journey">
        <div className="page-wrap home-journey-grid">
          <div>
            <div className="eyebrow">Booking flow</div>
            <h2 style={{ marginBottom: '1rem' }}>A smoother trip from request to arrival</h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.8, maxWidth: 520 }}>
              The experience is now clearer at every step, so users understand what to do next and feel confident while waiting for a ride.
            </p>
          </div>
          <div className="home-step-list">
            {journeySteps.map((step, index) => (
              <div key={step.id} className={`premium-card home-step-card animate-fade-up delay-${(index + 1) * 100}`}>
                <div className="home-step-id">{step.id}</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.55rem' }}>{step.title}</h3>
                  <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="animate-fade-up delay-200" style={{ background: 'var(--brand)', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', letterSpacing: '-1.5px', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Ready to upgrade every ride?
        </h2>
        <p style={{ color: 'color-mix(in srgb, var(--text-primary) 66%, transparent)', marginBottom: '2rem', fontSize: '1.05rem' }}>
          Create your account and start booking with a cleaner, smarter experience.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-dark btn-lg hover-scale" onClick={() => navigate('/signup')}>
            Create free account
          </button>
          <button className="btn btn-ghost btn-lg hover-scale" onClick={() => navigate('/login')}>
            Explore your dashboard
          </button>
        </div>
      </section>

      <footer style={{ background: 'var(--chrome-bg)', padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/support')}>
            Support center
          </button>
          <a className="btn btn-ghost btn-sm" href={getSupportCallHref()}>
            Call {SUPPORT_CONTACT.phoneDisplay}
          </a>
        </div>
        <div style={{ color: 'color-mix(in srgb, var(--chrome-fg) 34%, transparent)', fontSize: '0.85rem' }}>
          © {new Date().getFullYear()} BookCar.com — All rights reserved
        </div>
      </footer>
    </div>
  );
}
