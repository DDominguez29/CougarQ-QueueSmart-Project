import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import './AuthPages.css';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  note: string;
  children: ReactNode;
  footer: ReactNode;
}

function AuthLayout({ eyebrow, title, note, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="auth-header__content">
          <Link className="auth-brand" to="/login">
            <img
              className="auth-brand__logo"
              src="/logos/uh-logo.png"
              alt="University of Houston logo"
            />
            <div>
              <p className="auth-brand__name">CougarQ</p>
              <p className="auth-brand__subtitle">
                University of Houston Campus Store/Bookstore
              </p>
            </div>
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel__header">
            <p className="auth-panel__eyebrow">{eyebrow}</p>
            <h1 id="auth-title">{title}</h1>
            <p className="auth-panel__note">{note}</p>
          </div>

          <div className="auth-panel__body">{children}</div>

          <div className="auth-panel__footer">{footer}</div>
        </section>
      </main>
    </div>
  );
}

export default AuthLayout;
