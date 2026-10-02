import { useState, type InputHTMLAttributes } from 'react';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  showToggle?: boolean;
}

function AuthField({
  id,
  label,
  error,
  hint,
  showToggle = false,
  type = 'text',
  ...inputProps
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputType = showToggle && visible ? 'text' : type;

  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>
        {label}
      </label>

      <div className="auth-field__control">
        <input
          id={id}
          name={id}
          type={inputType}
          className={[
            'auth-input',
            showToggle ? 'auth-input--with-toggle' : '',
            error ? 'auth-input--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
        {showToggle && (
          <button
            type="button"
            className="auth-field__toggle"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {hint && !error && (
        <p className="auth-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="auth-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthField;
