import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AuthField from './AuthField';
import AuthLayout from './AuthLayout';
import {
  AUTH_LIMITS,
  STUDENT_EMAIL_DOMAIN,
  validateConfirmPassword,
  validateFullName,
  validateNewPassword,
  validateRegisterEmail,
} from './authValidation';
import { emailExists, registerAccount } from './mockAuth';

type RegisterField = 'fullName' | 'email' | 'password' | 'confirmPassword';
type RegisterErrors = Partial<Record<RegisterField, string>>;

const initialTouched: Record<RegisterField, boolean> = {
  fullName: false,
  email: false,
  password: false,
  confirmPassword: false,
};

function RegisterPage() {
  const navigate = useNavigate();

  const [values, setValues] = useState<Record<RegisterField, string>>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [touched, setTouched] = useState(initialTouched);
  const [formError, setFormError] = useState('');

  const errors: RegisterErrors = {
    fullName: validateFullName(values.fullName),
    email: validateRegisterEmail(values.email),
    password: validateNewPassword(values.password),
    confirmPassword: validateConfirmPassword(
      values.password,
      values.confirmPassword,
    ),
  };

  function handleChange(field: RegisterField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function handleBlur(field: RegisterField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function showError(field: RegisterField) {
    return touched[field] ? errors[field] : undefined;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (Object.values(errors).some(Boolean)) return;

    if (emailExists(values.email)) {
      setFormError('An account with this email already exists.');
      return;
    }

    registerAccount(values.fullName, values.email, values.password);
    navigate('/login', {
      state: { registeredEmail: values.email.trim().toLowerCase() },
    });
  }

  return (
    <AuthLayout
      eyebrow="Student access"
      title="Create an account"
      note="Register with your CougarNet email to join bookstore queues."
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      {formError && (
        <div className="auth-alert auth-alert--error" role="alert">
          {formError}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="fullName"
          label="Full name"
          autoComplete="name"
          maxLength={AUTH_LIMITS.nameMax}
          value={values.fullName}
          onChange={(event) => handleChange('fullName', event.target.value)}
          onBlur={() => handleBlur('fullName')}
          error={showError('fullName')}
          required
        />

        <AuthField
          id="email"
          label="CougarNet email"
          type="email"
          autoComplete="email"
          placeholder={`username@${STUDENT_EMAIL_DOMAIN}`}
          maxLength={AUTH_LIMITS.emailMax}
          value={values.email}
          onChange={(event) => handleChange('email', event.target.value)}
          onBlur={() => handleBlur('email')}
          error={showError('email')}
          hint="This will be your username."
          required
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          maxLength={AUTH_LIMITS.passwordMax}
          value={values.password}
          onChange={(event) => handleChange('password', event.target.value)}
          onBlur={() => handleBlur('password')}
          error={showError('password')}
          hint={`At least ${AUTH_LIMITS.passwordMin} characters with a letter and a number.`}
          showToggle
          required
        />

        <AuthField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          maxLength={AUTH_LIMITS.passwordMax}
          value={values.confirmPassword}
          onChange={(event) =>
            handleChange('confirmPassword', event.target.value)
          }
          onBlur={() => handleBlur('confirmPassword')}
          error={showError('confirmPassword')}
          showToggle
          required
        />

        <button className="auth-submit" type="submit">
          Create account
        </button>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
