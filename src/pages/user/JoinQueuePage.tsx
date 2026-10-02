import { Link } from 'react-router-dom';

import { availableServices } from '../../design/queueSmartDesign';

import './JoinQueuePage.css';

function JoinQueuePage() {
  return (
    <div className="join-queue-page">
      <header className="join-queue-header">
        <div className="join-queue-header__content">
          <div>
            <h1>Join Queue</h1>
            <p>Select a service and join the line.</p>
          </div>

          <Link className="join-queue-back" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="join-queue-main">
        <section className="join-queue-panel">
          <p className="join-queue-eyebrow">AVAILABLE SERVICES</p>
          <h2>Choose a Queue</h2>

          <div className="join-service-list">
            {availableServices.map((service) => (
              <article className="join-service-card" key={service.name}>
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.waiting} students waiting</p>
                  <p>Estimated wait: {service.estimatedWait}</p>
                </div>

                <div className="join-service-card__right">
                  <span className="join-service-status">
                    {service.status}
                  </span>

                  <button className="join-queue-button">
                    Join Queue
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default JoinQueuePage;