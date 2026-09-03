import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function NotFoundPage() {
  return (
    <div className="page-content" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div
        className="card center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{ maxWidth: 400, padding: 40, textAlign: "center" }}
      >
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>🧭</div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Page Not Found
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "0.95rem", lineHeight: 1.5 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn btn-primary" style={{ display: "inline-flex", textDecoration: "none" }}>
          Go to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
