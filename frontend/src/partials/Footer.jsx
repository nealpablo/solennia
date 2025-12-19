import { Link, useNavigate } from "react-router-dom";

export default function Footer() {
  const navigate = useNavigate();

  function handleFeedback(e) {
    e.preventDefault();
    // If you later convert feedback modal to React state,
    // this can be replaced with context / modal store
    const el = document.getElementById("feedbackModal");
    if (el) el.classList.remove("hidden");
  }

  return (
    <footer className="bg-[#353946] text-[#f6f0e8] py-10">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-10 text-sm">

        {/* BRAND */}
        <div>
          <img
            src="/images/solennia.png"
            alt="Solennia logo"
            className="h-12 w-auto select-none"
          />
          <h3 className="text-lg font-semibold mb-3">Solennia</h3>
          <p className="text-gray-300">
            “One click closer to the perfect event.”
          </p>
          <p className="mt-4 text-gray-400">
            © 2025 Solennia. All rights reserved.
          </p>
          <p className="mt-2">solenniainquires@gmail.com</p>
        </div>

        {/* NAVIGATION */}
        <ul className="space-y-2">
          <li>
            <Link to="/" className="hover:underline">
              HOME
            </Link>
          </li>

          <li>
            <Link to="/about" className="hover:underline">
              ABOUT US
            </Link>
          </li>

          <li>
            <Link to="/vendors" className="hover:underline">
              EXPLORE VENDORS
            </Link>
          </li>

          <li>
            <Link to="/ai-planner" className="hover:underline">
              WEDDING PLANNER AI
            </Link>
          </li>
        </ul>

        {/* LEGAL */}
        <ul className="space-y-2">
          <li>
            <Link to="/privacy" className="hover:underline">
              PRIVACY POLICY
            </Link>
          </li>

          <li>
            <Link to="/terms" className="hover:underline">
              TERMS & CONDITIONS
            </Link>
          </li>

          <li>
            <Link to="/vendor-agreement" className="hover:underline">
              VENDOR AGREEMENT
            </Link>
          </li>

          <li>
            <button
              onClick={handleFeedback}
              className="hover:underline text-left"
            >
              GIVE FEEDBACK
            </button>
          </li>
        </ul>

      </div>
    </footer>
  );
}
