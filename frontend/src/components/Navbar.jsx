import { Link } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#085041" />
          <rect x="11" y="6" width="10" height="5" rx="2.5" fill="#5DCAA5" />
          <rect
            x="7"
            y="13"
            width="18"
            height="5"
            rx="2.5"
            fill="#5DCAA5"
            opacity="0.75"
          />
          <rect
            x="3"
            y="20"
            width="26"
            height="5"
            rx="2.5"
            fill="#5DCAA5"
            opacity="0.5"
          />
        </svg>
        <span className="navbar-name">StackWise</span>
        <span className="navbar-divider">|</span>
        <span className="navbar-product">UptimeWatch</span>
      </Link>
      <span className="navbar-tagline">Website Monitoring</span>
    </nav>
  );
}
