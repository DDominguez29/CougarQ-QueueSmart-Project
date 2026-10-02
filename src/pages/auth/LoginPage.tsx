import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import AuthField from './AuthField';
import AuthLayout from './AuthLayout';
import {
  AUTH_LIMITS,
  validateLoginEmail,
  validateLoginPassword,
} from './authValidation';
import { findAccount } from './mockAuth';

type LoginField = 'email' | 'password';
type LoginErrors = Partial<Record<LoginField, string>>;

interface LoginLocationState {
  registeredEmail?: string;
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [registeredEmail] = useState(
    () => (location.state as LoginLocationState | null)?.registeredEmail,
  );

  useEffect(() => {
    if (registeredEmail) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [registeredEmail, location.pathname, navigate]);

  const [values, setValues] = useState({
    email: registeredEmail ?? '',
    password: '',
  });
  const [touched, setTouched] = useState<Record<LoginField, boolean>>({
    email: false,
    password: false,
  });
  const [formError, setFormError] = useState('');

  const errors: LoginErrors = {
    email: validateLoginEmail(values.email),
    password: validateLoginPassword(values.password),
  };

  function handleChange(field: LoginField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function handleBlur(field: LoginField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (errors.email || errors.password) return;

    const account = findAccount(values.email, values.password);
    if (!account) {
      setFormError('Email or password is incorrect.');
      return;
    }

    navigate(account.role === 'admin' ? '/admin' : '/dashboard');
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in"
      note="Join CTAP pickup and bookstore queues without waiting in line."
      footer={
        <p>
          New to CougarQ? <Link to="/register">Create an account</Link>
        </p>
      }
    >
      {registeredEmail && !formError && (
        <div className="auth-alert auth-alert--success" role="status">
          Account created. Sign in to continue.
        </div>
      )}
      {formError && (
        <div className="auth-alert auth-alert--error" role="alert">
          {formError}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="username@cougarnet.uh.edu"
          maxLength={AUTH_LIMITS.emailMax}
          value={values.email}
          onChange={(event) => handleChange('email', event.target.value)}
          onBlur={() => handleBlur('email')}
          error={touched.email ? errors.email : undefined}
          required
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          maxLength={AUTH_LIMITS.passwordMax}
          value={values.password}
          onChange={(event) => handleChange('password', event.target.value)}
          onBlur={() => handleBlur('password')}
          error={touched.password ? errors.password : undefined}
          showToggle
          required
        />

        <button className="auth-submit" type="submit">
          Sign in
        </button>
      </form>

      <div className="auth-demo">
        <p className="auth-demo__title">Test accounts</p>
        <p>Student: student@cougarnet.uh.edu / Cougar123</p>
        <p>Admin: admin@uh.edu / Admin123</p>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
