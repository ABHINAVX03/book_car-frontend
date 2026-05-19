import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useToast } from "./hooks/useToast";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar";
import ToastContainer from "./components/ToastContainer";
import ErrorBoundary from "./components/ErrorBoundary";

const HomePage = lazy(() => import("./pages/HomePage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const BookRidePage = lazy(() => import("./pages/BookRidePage"));
const DriverPanelPage = lazy(() => import("./pages/DriverPanelPage"));
const RidesPage = lazy(() => import("./pages/RidesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const AdminRevenuePage = lazy(() => import("./pages/AdminRevenuePage"));
const DriverVerificationPage = lazy(() => import("./pages/DriverVerificationPage"));
const AdminVerificationDashboard = lazy(() => import("./pages/AdminVerificationDashboard"));

const PENDING_DRIVER_VEHICLE_KEY = "bookcar-pending-driver-vehicle";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.some((role) => user.roles?.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function GuestRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const pendingDriverVehicle =
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem(PENDING_DRIVER_VEHICLE_KEY) === "1";

  if (user) {
    if (location.pathname === "/signup" && pendingDriverVehicle) {
      return children;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

const Layout = ({ toast }) => {
  const location = useLocation();
  const noNavPages = ["/signup", "/login", "/"];
  const showNav = !noNavPages.includes(location.pathname);

  return (
    <>
      {showNav && <Navbar toast={toast} />}
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        >
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

const PageLoading = () => (
  <div className="page-content">
    <div className="card center" aria-live="polite">
      <span className="spinner" />
    </div>
  </div>
);

function RouteAwareBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function AppInner() {
  const { toasts, toast, dismissToast } = useToast();

  return (
    <BrowserRouter>
      <RouteAwareBoundary>
        <Routes>
          <Route path="/" element={<Layout toast={toast} />}>
            <Route index element={<HomePage />} />
            <Route path="signup" element={<GuestRoute><SignupPage toast={toast} /></GuestRoute>} />
            <Route path="login" element={<GuestRoute><LoginPage toast={toast} /></GuestRoute>} />

            <Route path="dashboard" element={<ProtectedRoute><DashboardPage toast={toast} /></ProtectedRoute>} />
            <Route path="book" element={<ProtectedRoute allowedRoles={["RIDER"]}><BookRidePage toast={toast} /></ProtectedRoute>} />
            <Route path="driver" element={<ProtectedRoute allowedRoles={["DRIVER"]}><DriverPanelPage toast={toast} /></ProtectedRoute>} />
            <Route path="rides" element={<ProtectedRoute><RidesPage toast={toast} /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><ProfilePage toast={toast} /></ProtectedRoute>} />
            <Route path="support" element={<SupportPage />} />

            <Route path="admin/revenue" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminRevenuePage toast={toast} /></ProtectedRoute>} />
            <Route path="admin/verify" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminVerificationDashboard toast={toast} /></ProtectedRoute>} />
            <Route path="driver/verify" element={<ProtectedRoute allowedRoles={["DRIVER"]}><DriverVerificationPage toast={toast} /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </RouteAwareBoundary>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
