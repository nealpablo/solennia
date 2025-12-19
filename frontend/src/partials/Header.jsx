// Header.jsx
import { Link, useNavigate } from "react-router-dom";

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="bg-[#e8ddae] border-b border-gray-300">
      <nav className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">

        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2 text-xl tracking-wide">
          <span>SOLENNIA</span>
        </Link>

        {/* MOBILE MENU BUTTON (JS LOGIC CAN BE ADDED LATER) */}
        <button
          className="md:hidden p-2 rounded hover:bg-black/5"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* NAV LINKS */}
        <ul className="hidden md:flex items-center gap-6 text-sm font-medium">
          <li>
            <Link to="/" className="hover:underline">HOME</Link>
          </li>
          <li>
            <Link to="/vendors" className="hover:underline">VENDORS</Link>
          </li>
          <li>
            <Link to="/about" className="hover:underline">ABOUT US</Link>
          </li>
        </ul>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2">

          {/* SEARCH (UI ONLY, LOGIC UNCHANGED) */}
          <button className="p-2 rounded hover:bg-black/5" aria-label="Search">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>

          {/* MESSAGES */}
          <button
            onClick={() => navigate("/chat")}
            className="p-2 rounded hover:bg-black/5"
            aria-label="Messages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a4 4 0 0 1-4 4H8l-4 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4z" />
            </svg>
          </button>

          {/* PROFILE */}
          <button
            onClick={() => navigate("/profile")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-400 hover:bg-black/5"
            aria-label="Profile"
          >
            <svg
              className="w-5 h-5 text-gray-700"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
            </svg>
          </button>

        </div>
      </nav>
    </header>
  );
}
