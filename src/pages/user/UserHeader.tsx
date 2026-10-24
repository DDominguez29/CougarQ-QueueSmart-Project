import { NavLink } from 'react-router-dom';
import LogoutButton from '../../components/LogoutButton';
import './UserDashboardPage.css';

function UserHeader() {
  return (
    <header className="user-header">
      <div className="user-header__content">
        <div className="user-brand">
          <img className="user-brand__logo" src="/logos/uh-logo.png" alt="University of Houston logo" />
          <div>
            <p className="user-brand__name">CougarQ</p>
            <p className="user-brand__subtitle">University of Houston Campus Store/Bookstore</p>
          </div>
        </div>
        <nav className="user-nav" aria-label="User navigation">
          {[
            ['/dashboard', 'Dashboard'], ['/join-queue', 'Join Queue'],
            ['/queue-status', 'Queue Status'], ['/history', 'History'], ['/notifications', 'Notifications'],
          ].map(([path, label]) => (
            <NavLink key={path} to={path} className={({ isActive }) => `user-nav__link${isActive ? ' user-nav__link--active' : ''}`}>
              {label}
            </NavLink>
          ))}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

export default UserHeader;
