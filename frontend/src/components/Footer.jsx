/**
 * components/Footer.jsx
 */

import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <p className="footer-brand">
            Campus <strong>Lost &amp; Found</strong>
          </p>
          <p className="text-subtle">
            A private platform for verified college members. Report what you
            lost, return what you found.
          </p>
        </div>

        <nav aria-label="Footer">
          <ul className="footer-links">
            <li>
              <Link to="/items">Browse items</Link>
            </li>
            <li>
              <Link to="/report">Report an item</Link>
            </li>
            <li>
              <Link to="/my-claims">My claims</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="container footer-bottom">
        <p className="text-subtle">
          Contact details stay hidden until a claim is verified.
        </p>
      </div>
    </footer>
  );
}
