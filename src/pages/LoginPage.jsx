import { login as apiLogin, getRiderProfile, getDriverProfile, resetPassword } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getFriendlyAuthError } from "../utils/errorMessages";
import { getCachedPhoneNumber } from "../utils/userContactCache";
import { FiArrowRight, FiLock, FiMail, FiShield } from "react-icons/fi";

import { useNavigate } from "react-router-dom";

export default function LoginPage({ toast }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [inlineFeedback, setInlineFeedback] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const normalizeRoles = (roles) => {
    if (!roles) return [];
    if (Array.isArray(roles)) return roles;
    if (typeof roles === 'string') {
      const text = roles.trim();
      if (text.startsWith('[') && text.endsWith(']')) {
        return text
          .slice(1, -1)
          .split(',')
          .map(role => role.trim().replace(/^"|"$/g, ''))
          .filter(Boolean);
      }
      return [text];
    }
    return [];
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      const feedback = {
        title: "A few details are missing",
        description: "Please enter both your email address and password before signing in.",
        type: "error",
      };
      setInlineFeedback(feedback);
      toast.error(feedback);
      return;
    }

    setInlineFeedback(null);
    setLoading(true);
    try {
      const res = await apiLogin(form);
      let user = res?.user || res?.data || res;
      let roles = normalizeRoles(user?.roles || []);
      const authPayload = {
        accessToken: res?.accessToken,
        refreshToken: res?.refreshToken,
      };

      if (!user || !user?.email) {
        try {
          user = await getRiderProfile();
          roles = normalizeRoles(user?.roles || ["RIDER"]);
        } catch {
          const driverProfile = await getDriverProfile();
          user = driverProfile;
          roles = normalizeRoles(user?.roles || ["DRIVER"]);
        }
      }

      login({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || getCachedPhoneNumber(user.email),
        roles: roles.length ? roles : ['RIDER'],
        ...authPayload,
      });
      const successMessage = {
        title: `Welcome back, ${user.name || 'there'}`,
        description: "Your account is ready and your dashboard is loading now.",
        type: "success",
      };
      setInlineFeedback({
        title: "Signed in successfully",
        description: "Redirecting you to your dashboard.",
        type: "success",
      });
      toast.success(successMessage);
      navigate('/dashboard');
    } catch (e) {
      const feedback = getFriendlyAuthError(e, "We couldn't sign you in");
      setInlineFeedback(feedback);
      toast.error(feedback);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!form.email || !newPass) {
      toast.error("Please enter your email and a new password.");
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword({ email: form.email.trim(), newPassword: newPass });
      toast.success("Password reset successfully! You can now sign in.");
      set('password', newPass);
      setShowForgot(false);
      setNewPass('');
    } catch (e) {
      toast.error(e?.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="animate-page-enter auth-shell">
      <div className="auth-layout">
        <div className="auth-spotlight animate-fade-up hide-mobile">
          <div className="auth-spotlight-badge">
            <FiShield />
            Trusted ride access
          </div>
          <h1>Return to your rides with a calmer, cleaner sign-in flow.</h1>
          <p>
            Premium dashboards, clearer feedback, and fast access to booking, wallet, and driver controls.
          </p>
          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <FiShield />
              Session-aware protection
            </div>
            <div className="auth-feature-item">
              <FiMail />
              Cleaner account recovery messaging
            </div>
            <div className="auth-feature-item">
              <FiLock />
              Professional in-app feedback
            </div>
          </div>
        </div>

        <div className="auth-card auth-card-premium animate-fade-up" style={{ maxWidth: 480 }}>
          <div className="auth-brand" onClick={() => navigate('/')}>
            Book<span>Car</span>
            <span className="auth-brand-dot">.com</span>
          </div>

          <div className="auth-copy-block">
            <div className="eyebrow">Member sign in</div>
            <h2 style={{ fontSize: '2.1rem', letterSpacing: '-1.2px', marginBottom: '0.45rem' }}>Welcome back</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.98rem', lineHeight: 1.7 }}>
              Sign in to manage your rides, wallet, saved details, and driver activity with confidence.
            </p>
          </div>

          {inlineFeedback ? (
            <div className={`inline-feedback ${inlineFeedback.type || "info"}`}>
              <div className="inline-feedback-title">{inlineFeedback.title}</div>
              <div className="inline-feedback-description">{inlineFeedback.description}</div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Email address</label>
              <div className="input-premium-wrap">
                <FiMail className="input-premium-icon" />
                <input className="input-field input-premium" type="email" placeholder="you@email.com"
                  value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="label" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  style={{ fontSize: '0.78rem', color: 'var(--brand-dark)', cursor: 'pointer', border: 'none', background: 'none', fontWeight: 600 }}
                  onClick={() => setShowForgot(!showForgot)}
                >
                  {showForgot ? 'Cancel' : 'Forgot password?'}
                </button>
              </div>
              <div className="input-premium-wrap">
                <FiLock className="input-premium-icon" />
                <input className="input-field input-premium" type="password" placeholder="Your password"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
            </div>

            {showForgot && (
              <div className="animate-fade-in" style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Reset your password</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
                  Enter a new password for <strong>{form.email || "your email"}</strong> below:
                </p>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Enter new password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  style={{ background: 'var(--white)' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleResetPassword}
                  disabled={resetLoading || !form.email || !newPass}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {resetLoading ? 'Saving...' : 'Set new password'}
                </button>
              </div>
            )}
          </div>

          <button className="btn btn-dark btn-full btn-lg hover-shrink btn-premium" style={{ marginTop: '1.5rem' }}
            onClick={handleLogin} disabled={loading}>
            {loading ? <span className="spinner spinner-white" /> : <>Sign in <FiArrowRight /></>}
          </button>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.92rem', color: 'var(--muted)' }}>
            New to BookCar?{' '}
            <span className="premium-inline-link" onClick={() => navigate('/signup')}>
              Create an account
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
