// Footer.jsx
export default function Footer() {
  return (
    <footer className="bg-[#353946] text-[#f6f0e8] py-10">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-10 text-sm">
        {/* Brand */}
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

        {/* Navigation */}
        <ul className="space-y-2">
          <li>
            <a href="/index.html" className="hover:underline">
              HOME
            </a>
          </li>
          <li>
            <a href="/aboutus.html" className="hover:underline">
              ABOUT US
            </a>
          </li>
          <li>
            <a href="/index.html#gallery" className="hover:underline">
              EXPLORE VENDORS
            </a>
          </li>
          <li>
            <a href="#" className="hover:underline">
              WEDDING PLANNER AI
            </a>
          </li>
        </ul>

        {/* Legal */}
        <ul className="space-y-2">
          <li>
            <a href="#" id="footerPrivacyPolicy" className="hover:underline">
              PRIVACY POLICY
            </a>
          </li>
          <li>
            <a href="#" id="footerTermsLink" className="hover:underline">
              TERMS & CONDITIONS
            </a>
          </li>
          <li>
            <a href="#" className="hover:underline">
              VENDOR AGREEMENT
            </a>
          </li>
          <li>
            <a href="#" id="footerFeedbackLink" className="hover:underline">
              GIVE FEEDBACK
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
