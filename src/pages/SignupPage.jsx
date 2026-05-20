import { useState } from "react";
import { signup, login as apiLogin, onboardDriver, getRiderProfile, getDriverProfile, sendOtp, verifyOtp } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getFriendlyAuthError } from "../utils/errorMessages";
import { formatPhoneNumber, isValidPhoneNumber, sanitizePhoneNumber } from "../utils/phone";
import { FiArrowRight, FiBriefcase, FiMail, FiPhone, FiShield, FiUser } from "react-icons/fi";

import { useNavigate } from "react-router-dom";

const PENDING_DRIVER_VEHICLE_KEY = "bookcar-pending-driver-vehicle";

export default function SignupPage({ toast }) {
  const navigate = useNavigate();
  const { login, user: currentUser } = useAuth();
  const [step, setStep] = useState(1); // 1=signup form, 2=onboard driver
  const [mode, setMode] = useState('rider'); // rider | driver
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [createdUser, setCreatedUser] = useState(null);
  const [inlineFeedback, setInlineFeedback] = useState(null);

  const [form, setForm] = useState({ name: '', email: '', password: '', phoneNumber: '' });
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleType, setVehicleType] = useState('MINI');

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password || !form.phoneNumber) {
      const feedback = {
        title: "Almost there",
        description: "Please complete every field, including your phone number, before creating your account.",
        type: "error",
      };
      setInlineFeedback(feedback);
      toast.error(feedback);
      return;
    }

    if (!isValidPhoneNumber(form.phoneNumber)) {
      const feedback = {
        title: "Enter a valid Indian phone number",
        description: "Please enter a valid 10-digit mobile number within India (+91) so contact details stay usable across the app.",
        type: "error",
      };
      setInlineFeedback(feedback);
      toast.error(feedback);
      return;
    }

    setInlineFeedback(null);
    setLoading(true);
    try {
      const payload = { 
        ...form, 
        phoneNumber: formatPhoneNumber(form.phoneNumber),
        role: mode.toUpperCase() 
      };
      const user = await signup(payload);
      setCreatedUser(user);
      const uid = user?.id ?? user?.userId ?? user?.data?.id;
      setUserId(uid);

      const loginResponse = await apiLogin({ email: form.email, password: form.password });

      if (mode === 'driver') {
        try {
          sessionStorage.setItem(PENDING_DRIVER_VEHICLE_KEY, "1");
          setUserId(user.id);
        } catch {
          /* ignore */
        }
        login(
          {
            name: user?.name || form.name,
            email: user?.email || form.email,
            phoneNumber: user?.phoneNumber || payload.phoneNumber,
            roles: ["DRIVER"],
            accessToken: loginResponse?.accessToken,
            refreshToken: loginResponse?.refreshToken,
          },
        );
        setStep(2);
        toast.success({
          title: "Account created",
          description: "Complete your driver setup to unlock ride requests and dashboard controls.",
        });
      } else {
        // Rider auto-login with the returned user and save token if present
        let profileUser = user;
        let roles = profileUser?.user?.roles || profileUser?.roles || ['RIDER'];

        if (!(profileUser?.user?.name || profileUser?.name) || !(profileUser?.user?.email || profileUser?.email) || !(profileUser?.user?.phoneNumber || profileUser?.phoneNumber)) {
          login({ name: '', email: '', roles: [] });
          try {
            profileUser = await getRiderProfile();
            roles = profileUser?.user?.roles || profileUser?.roles || ['RIDER'];
          } catch {
            const driverProfile = await getDriverProfile();
            profileUser = driverProfile;
            roles = profileUser?.user?.roles || profileUser?.roles || ['DRIVER'];
          }
        }

        login({
          name: profileUser?.user?.name || profileUser?.name || user.name,
          email: profileUser?.user?.email || profileUser?.email || user.email,
          phoneNumber: profileUser?.user?.phoneNumber || profileUser?.phoneNumber || user.phoneNumber || payload.phoneNumber,
          roles: roles,
          accessToken: loginResponse?.accessToken,
          refreshToken: loginResponse?.refreshToken,
        });
        toast.success({
          title: `Welcome to BookCar, ${profileUser?.name || user.name}!`,
          description: "Your account is ready and your dashboard is waiting.",
        });
        navigate('/dashboard');
      }
    } catch (e) {
      const feedback = getFriendlyAuthError(e, "We couldn't create your account");
      setInlineFeedback(feedback);
      toast.error(feedback);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!isValidPhoneNumber(form.phoneNumber)) {
      toast.error("Please enter a valid phone number first.");
      return;
    }
    setOtpLoading(true);
    try {
      await sendOtp(formatPhoneNumber(form.phoneNumber));
      setOtpSent(true);
      toast.success("Verification code sent to your phone!");
    } catch (e) {
      toast.error(e.message || "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Enter a 6-digit code.");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await verifyOtp(formatPhoneNumber(form.phoneNumber), otpCode);
      if (res.valid) {
        setIsPhoneVerified(true);
        toast.success("Phone number verified!");
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
    } catch (e) {
      toast.error(e.message || "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOnboard = async () => {
    if (!vehicleId) {
      const feedback = {
        title: "Vehicle registration is required",
        description: "Enter your vehicle number so we can finish your driver setup.",
        type: "error",
      };
      setInlineFeedback(feedback);
      toast.error(feedback);
      return;
    }
    const uid = userId;
    if (!uid) {
      toast.error("User session lost. Please refresh and try again.");
      return;
    }
    setInlineFeedback(null);
    setLoading(true);
    try {
      const driver = await onboardDriver(uid, vehicleId, vehicleType, formatPhoneNumber(form.phoneNumber));
      try {
        sessionStorage.removeItem(PENDING_DRIVER_VEHICLE_KEY);
      } catch {
        /* ignore */
      }
      const loginResponse = await apiLogin({ email: form.email, password: form.password });

      login({
        name: createdUser?.name || form.name || form.email,
        email: createdUser?.email || form.email,
        phoneNumber: createdUser?.phoneNumber || formatPhoneNumber(form.phoneNumber),
        roles: ['DRIVER'],
        accessToken: loginResponse?.accessToken,
        refreshToken: loginResponse?.refreshToken,
      });
      toast.success({
        title: "Driver profile activated",
        description: `Vehicle ${driver.vehicleId} is now ready for driver mode.`,
      });
      navigate('/driver');
    } catch (e) {
      const feedback = getFriendlyAuthError(e, "Unable to complete driver setup");
      setInlineFeedback(feedback);
      toast.error(feedback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-page-enter" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left panel */}
      <div style={{
        width: '42%',
        background: 'var(--chrome-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }} className="hide-mobile">
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: 360, height: 360,
          background: 'var(--brand)', borderRadius: '50%', opacity: 0.07,
        }} />
        <div
          style={{ fontFamily: 'Clash Display', fontSize: '1.6rem', fontWeight: 700, color: 'var(--brand)', marginBottom: '3rem', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          BookCar<span style={{ color: 'var(--chrome-fg)' }}>.com</span>
        </div>

        <h1 style={{ color: 'var(--chrome-fg)', fontSize: '2.6rem', letterSpacing: '-1.5px', marginBottom: '1rem' }}>
          {step === 1 ? 'Join the\njourney.' : 'One last\nstep.'}
        </h1>
        <p style={{ color: 'var(--hero-text-muted)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 260 }}>
          {step === 1
            ? 'Create your account and start booking rides in minutes.'
            : 'Register your vehicle to start accepting rides on BookCar.'}
        </p>

        {step === 1 && (
          <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Instant ride matching', 'Verified, rated drivers', 'Live GPS tracking', 'Secure payments'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
                <span style={{ fontSize: '0.88rem', color: 'var(--hero-text-muted)' }}>{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'var(--surface)',
      }}>
        <div className="auth-card auth-card-premium animate-fade-up delay-100" style={{ maxWidth: 460 }}>
          {inlineFeedback ? (
            <div className={`inline-feedback ${inlineFeedback.type || "info"}`} style={{ marginBottom: '1.25rem' }}>
              <div className="inline-feedback-title">{inlineFeedback.title}</div>
              <div className="inline-feedback-description">{inlineFeedback.description}</div>
            </div>
          ) : null}
          {step === 1 ? (
            <>
              <h2 style={{ fontSize: '1.8rem', letterSpacing: '-0.8px', marginBottom: '0.3rem' }}>
                Create your account
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                Start as a rider or driver and get set up in just a few steps.
              </p>

              {/* Mode tabs */}
              <div style={{
                display: 'flex',
                background: 'var(--surface-2)',
                borderRadius: 12,
                padding: 4,
                marginBottom: '1.5rem',
              }}>
                {[
                  { val: 'rider', label: 'Rider', desc: 'Book rides' },
                  { val: 'driver', label: 'Driver', desc: 'Earn money' },
                ].map(m => (
                  <button
                    type="button"
                    key={m.val}
                    onClick={() => {
                      if (m.val === "rider") {
                        try {
                          sessionStorage.removeItem(PENDING_DRIVER_VEHICLE_KEY);
                        } catch {
                          /* ignore */
                        }
                      }
                      setMode(m.val);
                    }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 9, border: 'none',
                      background: mode === m.val ? 'var(--white)' : 'transparent',
                      color: mode === m.val ? 'var(--text-primary)' : 'var(--muted)',
                      fontWeight: mode === m.val ? 700 : 400,
                      cursor: 'pointer',
                      fontFamily: 'Cabinet Grotesk, sans-serif',
                      fontSize: '0.9rem',
                      boxShadow: mode === m.val ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Full name</label>
                  <div className="input-premium-wrap">
                    <FiUser className="input-premium-icon" />
                    <input
                      className="input-field input-premium"
                      placeholder="Alex Johnson"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Email address</label>
                  <div className="input-premium-wrap">
                    <FiMail className="input-premium-icon" />
                    <input
                      className="input-field input-premium"
                      type="email"
                      placeholder="alex@email.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Phone number</label>
                  <div className="input-premium-wrap">
                    <FiPhone className="input-premium-icon" />
                    <input
                      className="input-field input-premium"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={form.phoneNumber}
                      disabled={isPhoneVerified}
                      onChange={e => {
                        set('phoneNumber', sanitizePhoneNumber(e.target.value));
                        if (otpSent) setOtpSent(false); // Reset if number changed
                      }}
                      onBlur={() => {
                        if (form.phoneNumber) {
                          set('phoneNumber', formatPhoneNumber(form.phoneNumber));
                        }
                      }}
                    />
                    {!isPhoneVerified && (
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ position: 'absolute', right: 10, top: 8, fontSize: '0.7rem', padding: '4px 8px' }}
                        onClick={handleSendOtp}
                        disabled={otpLoading || !form.phoneNumber}
                      >
                        {otpLoading ? '...' : (otpSent ? 'Resend' : 'Send code')}
                      </button>
                    )}
                    {isPhoneVerified && (
                      <span style={{ position: 'absolute', right: 12, top: 12, color: 'var(--green)', fontSize: '0.8rem', fontWeight: 700 }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>
                </div>

                {otpSent && !isPhoneVerified && (
                  <div className="animate-fade-in" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 12 }}>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Enter 6-digit code</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        className="input-field"
                        placeholder="000000"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        style={{ textAlign: 'center', letterSpacing: 4, fontWeight: 700 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleVerifyOtp} disabled={otpLoading}>
                        Verify
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="label">Password</label>
                  <div className="input-premium-wrap">
                    <FiShield className="input-premium-icon" />
                    <input
                      className="input-field input-premium"
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSignup()}
                    />
                  </div>
                </div>
              </div>

                <button
                className={`btn btn-dark btn-full btn-lg hover-shrink ${!isPhoneVerified ? 'opacity-50' : ''}`}
                style={{ marginTop: '1.5rem' }}
                onClick={handleSignup}
                disabled={loading || !isPhoneVerified}
              >
                {loading ? <span className="spinner spinner-white" /> : <>Create {mode} account <FiArrowRight /></>}
              </button>

              <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.88rem', color: 'var(--muted)' }}>
                Already have an account?{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/login')}>
                  Sign in
                </span>
              </p>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="badge badge-yellow" style={{ marginBottom: '1rem' }}>Step 2 of 2</div>
                <h2 style={{ fontSize: '1.8rem', letterSpacing: '-0.8px', marginBottom: '0.3rem' }}>
                  Complete your driver setup
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Add your vehicle details to begin receiving ride requests.
                </p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Vehicle Registration ID</label>
                <div className="input-premium-wrap">
                  <FiBriefcase className="input-premium-icon" />
                  <input
                    className="input-field input-premium"
                    placeholder="e.g. MH12AB1234"
                    value={vehicleId}
                    onChange={e => setVehicleId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleOnboard()}
                  />
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 6 }}>
                  Enter the vehicle registration number exactly as on your RC book
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Car Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {['MINI', 'SEDAN', 'LUXE'].map(type => {
                    const isSelected = vehicleType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: '0.75rem', padding: '10px 4px' }}
                        onClick={() => setVehicleType(type)}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {userId && (
                <div style={{
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
                  marginBottom: '1rem',
                }}>
                  Your user ID: <strong style={{ color: 'var(--text-primary)' }}>#{userId}</strong>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-full btn-lg"
                onClick={handleOnboard}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : 'Finish setup'}
              </button>
              <button
                type="button"
                style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.88rem', width: '100%' }}
                onClick={() => setStep(1)}
              >
                Back to account details
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
