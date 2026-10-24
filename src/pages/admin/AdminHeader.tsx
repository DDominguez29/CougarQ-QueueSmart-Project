import { NavLink } from 'react-router-dom';
import LogoutButton from '../../components/LogoutButton';
import './AdminDashboardPage.css';

function AdminHeader() {
  return (
    <header className="admin-header">
      <div className="admin-header__content">
        <div className="admin-brand">
          <img className="admin-brand__logo" src="/logos/uh-logo.png" alt="University of Houston logo" />
          <div>
            <p className="admin-brand__name">CougarQ Admin</p>
            <p className="admin-brand__subtitle">University of Houston Campus Store/Bookstore</p>
          </div>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {[['/admin', 'Dashboard'], ['/admin/services', 'Services'], ['/admin/queue', 'Queue'], ['/admin/reports', 'Reports']].map(([path, label]) => (
            <NavLink key={path} to={path} end={path === '/admin'} className={({ isActive }) => `admin-nav__link${isActive ? ' admin-nav__link--active' : ''}`}>{label}</NavLink>
          ))}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

export default AdminHeader;
