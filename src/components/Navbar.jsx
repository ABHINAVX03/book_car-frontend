import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiBarChart2,
  FiCompass,
  FiHeadphones,
  FiLayout,
  FiMapPin,
  FiMenu,
  FiMoon,
  FiSun,
  FiTruck,
  FiUser,
  FiX,
} from "react-icons/fi";

export default function Navbar({ toast }) {
  const { user, logout, isDriver, isRider, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("bookcar-theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bookcar-theme", theme);
  }, [theme]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleLogout = () => {
    logout();
    toast?.success("You have been signed out.");
    navigate("/");
  };

  const navItems = [
    { label: "Support", icon: FiHeadphones, path: "/support", show: true },
    { label: "Dashboard", icon: FiLayout, path: "/dashboard", show: Boolean(user) },
    { label: "Book Ride", icon: FiCompass, path: "/book", show: isRider },
    { label: "Driver Panel", icon: FiTruck, path: "/driver", show: isDriver },
    { label: "My Rides", icon: FiMapPin, path: "/rides", show: Boolean(user) },
    { label: "Profile", icon: FiUser, path: "/profile", show: Boolean(user) },
    { label: "Revenue", icon: FiBarChart2, path: "/admin/revenue", show: isAdmin, isAdmin: true },
  ].filter((item) => item.show);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div
          className="navbar-logo animate-slide-right"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Book<span>Car</span>
          <span style={{ color: 'var(--brand)', fontSize: '0.55rem', verticalAlign: 'super', marginLeft: 2 }}>.com</span>
        </div>

        <button
          type="button"
          className="nav-mobile-toggle"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <FiX /> : <FiMenu />}
        </button>

        <div className={`navbar-panel ${isMenuOpen ? "open" : ""}`}>
          {user && (
            <div className="navbar-links">
              {navItems.map(({ label, icon: Icon, path, isAdmin: adminItem }, index) => (
                <button
                  key={path}
                  className={`nav-link animate-stagger-down delay-${Math.min(700, (index + 1) * 100)} ${pathname === path ? 'active' : ''}`}
                  onClick={() => navigate(path)}
                  style={adminItem ? { color: '#f59e0b', fontWeight: 700 } : {}}
                >
                  <Icon />
                  {label}
                  {adminItem && (
                    <span style={{ marginLeft: 4, fontSize: '0.62rem', background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: 6, padding: '1px 5px', verticalAlign: 'middle' }}>ADMIN</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="nav-user animate-stagger-down delay-500">
            <button type="button" className="theme-switch" onClick={toggleTheme}>
              <span className="theme-switch-track">
                {theme === "dark" ? <FiSun /> : <FiMoon />}
              </span>
              <span className="theme-switch-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>

          {user ? (
            <>
              <div className="avatar hover-shrink">{initials}</div>
              <span style={{ color: 'var(--nav-text)', fontSize: '0.85rem' }} className="hide-mobile">
                {user.name?.split(' ')[0]}
              </span>
              <button
                className="btn btn-ghost btn-sm hover-shrink"
                style={{ borderColor: 'var(--nav-border)', color: 'var(--nav-muted)' }}
                onClick={handleLogout}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm hover-shrink" style={{ borderColor: 'var(--nav-border)', color: 'var(--nav-muted)' }} onClick={() => navigate('/login')}>
                Sign in
              </button>
              <button className="btn btn-primary btn-sm hover-shrink" onClick={() => navigate('/signup')}>
                Sign up
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </nav>
  );
}
