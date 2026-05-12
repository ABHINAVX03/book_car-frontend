import { useState } from "react";
import { login as apiLogin, getRiderProfile, getDriverProfile } from "../services/api";
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
  const [inlineFeedback, setInlineFeedback] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const parseJwt = (jwt) => {
    try {
      const base64Url = jwt.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`).join(''));
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

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

      const token = res?.token || res?.accessToken || res?.jwt || res?.authToken || null;
      let user = res?.user || res?.data || res;
      let roles = normalizeRoles(user?.roles || []);
      let decodedRoles = [];

      if (!user?.name || !user?.email) {
        if (!token) {
          throw new Error('Login failed: missing authentication token');
        }

        const decoded = parseJwt(token);
        if (decoded?.email) {
          decodedRoles = normalizeRoles(decoded.roles || decoded.authorities || decoded.role || []);
          user = {
            name: decoded.name || decoded.email.split('@')[0] || '',
            email: decoded.email,
            phoneNumber: decoded.phoneNumber || decoded.phone || getCachedPhoneNumber(decoded.email),
            roles: decodedRoles,
          };
          roles = decodedRoles;
        }

        if (!user?.email) {
          // Save the token first so profile calls include it
          login({ name: '', email: '', roles: [] }, token);

          try {
            user = await getRiderProfile();
            roles = Array.from(new Set([...decodedRoles, ...normalizeRoles(user?.roles || ['RIDER'])]));
          } catch {
            const driverProfile = await getDriverProfile();
            user = driverProfile;
            roles = Array.from(new Set([...decodedRoles, ...normalizeRoles(user?.roles || ['DRIVER'])]));
          }
        }
      }

      if (!user || !user?.email) {
        throw new Error('Login failed: no user data returned');
      }

      login({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || getCachedPhoneNumber(user.email),
        roles: roles.length ? roles : ['RIDER'],
      }, token);
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
              <label className="label">Password</label>
              <div className="input-premium-wrap">
                <FiLock className="input-premium-icon" />
                <input className="input-field input-premium" type="password" placeholder="Your password"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
            </div>
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
