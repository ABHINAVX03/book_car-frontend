import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useToast } from "./hooks/useToast";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar";
import ToastContainer from "./components/ToastContainer";
import HomePage from "./pages/HomePage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BookRidePage from "./pages/BookRidePage";
import DriverPanelPage from "./pages/DriverPanelPage";
import RidesPage from "./pages/RidesPage";
import ProfilePage from "./pages/ProfilePage";
import SupportPage from "./pages/SupportPage";
import AdminRevenuePage from "./pages/AdminRevenuePage";

const ProtectedRoute = ({ children }) => {
  const { user, token } = useAuth();
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Redirect already-logged-in users away from login/signup
const GuestRoute = ({ children }) => {
  const { user, token } = useAuth();
  if (user && token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const Layout = ({ toast }) => {
  const location = useLocation();
  const noNavPages = ['/signup', '/login', '/'];
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
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </>
  );
};

function AppInner() {
  const { toasts, toast, dismissToast } = useToast();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout toast={toast} />}>
          <Route index element={<HomePage />} />
          <Route path="signup" element={<GuestRoute><SignupPage toast={toast} /></GuestRoute>} />
          <Route path="login" element={<GuestRoute><LoginPage toast={toast} /></GuestRoute>} />
          
          <Route path="dashboard" element={
            <ProtectedRoute><DashboardPage toast={toast} /></ProtectedRoute>
          } />
          <Route path="book" element={
            <ProtectedRoute><BookRidePage toast={toast} /></ProtectedRoute>
          } />
          <Route path="driver" element={
            <ProtectedRoute><DriverPanelPage toast={toast} /></ProtectedRoute>
          } />
          <Route path="rides" element={
            <ProtectedRoute><RidesPage toast={toast} /></ProtectedRoute>
          } />
          <Route path="profile" element={
            <ProtectedRoute><ProfilePage toast={toast} /></ProtectedRoute>
          } />
          <Route path="support" element={<SupportPage />} />
          <Route path="admin/revenue" element={
            <ProtectedRoute><AdminRevenuePage toast={toast} /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
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
