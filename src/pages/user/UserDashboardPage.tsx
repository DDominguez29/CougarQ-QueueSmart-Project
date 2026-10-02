import { Link } from 'react-router-dom';

import {
  availableServices,
  userQueue,
} from '../../design/queueSmartDesign';

import './UserDashboardPage.css';

function UserDashboardPage() {
  return (
    <div className="user-dashboard">
      <header className="user-header">
        <div className="user-header__content">
          <div className="user-brand">
            <img
              className="user-brand__logo"
              src="/logos/uh-logo.png"
              alt="University of Houston logo"
            />

            <div>
              <p className="user-brand__name">CougarQ</p>
              <p className="user-brand__subtitle">
                University of Houston Campus Store/Bookstore
              </p>
            </div>
          </div>

          <nav className="user-nav" aria-label="User navigation">
            <Link className="user-nav__link" to="/dashboard">
              Dashboard
            </Link>

            <Link className="user-nav__link" to="/join-queue">
              Join Queue
            </Link>

            <Link className="user-nav__link" to="/queue-status">
              Queue Status
            </Link>
          </nav>
        </div>
      </header>

      <main className="user-main">
        <section className="user-panel">
          <div className="user-panel__header">
            <div>
              <p className="user-panel__eyebrow">Today</p>
              <h1>User Dashboard</h1>
              <p className="user-panel__note">
                View your current queue position and available services.
              </p>
            </div>

            <span className="user-status">Live queue</span>
          </div>

          <div className="user-current-queue">
            <div>
              <p className="user-current-queue__label">Current Queue</p>
              <h2>{userQueue.service}</h2>
            </div>

            <div className="user-queue-stats">
              <div className="user-stat">
                <p className="user-stat__label">Position</p>
                <p className="user-stat__value">#{userQueue.position}</p>
              </div>

              <div className="user-stat">
                <p className="user-stat__label">Estimated Wait</p>
                <p className="user-stat__value">
                  {userQueue.estimatedWait}
                </p>
              </div>

              <div className="user-stat">
                <p className="user-stat__label">Status</p>
                <p className="user-stat__value">{userQueue.status}</p>
              </div>
            </div>

            <Link className="user-primary-button" to="/queue-status">
              View Queue Status
            </Link>
          </div>
        </section>

        <section className="user-panel">
          <div className="user-panel__header">
            <div>
              <p className="user-panel__eyebrow">Services</p>
              <h2>Available Services</h2>
            </div>
          </div>

          <div className="user-services">
            {availableServices.map((service) => (
              <article className="user-service-card" key={service.name}>
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.waiting} students waiting</p>
                  <p>Estimated wait: {service.estimatedWait}</p>
                </div>

                <div className="user-service-card__footer">
                  <span className="user-service-status">
                    {service.status}
                  </span>

                  <Link
                    className="user-secondary-button"
                    to="/join-queue"
                  >
                    Join Queue
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default UserDashboardPage;