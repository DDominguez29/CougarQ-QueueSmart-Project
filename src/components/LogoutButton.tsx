import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutRequest } from '../api/auth';
import { requestError } from '../api/client';
import './LogoutButton.css';

function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await logoutRequest();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(requestError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="session-actions">
      <button className="session-signout" type="button" onClick={() => void signOut()} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}

export default LogoutButton;
