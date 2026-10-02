export const STUDENT_EMAIL_DOMAIN = 'cougarnet.uh.edu';
export const STAFF_EMAIL_DOMAIN = 'uh.edu';

export const AUTH_LIMITS = {
  nameMax: 60,
  emailMax: 100,
  passwordMin: 8,
  passwordMax: 64,
};

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_FORMAT = /^[A-Za-z][A-Za-z '.-]*$/;

function getDomain(email: string) {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isStudentEmail(email: string) {
  return getDomain(email) === STUDENT_EMAIL_DOMAIN;
}

export function isStaffEmail(email: string) {
  return getDomain(email) === STAFF_EMAIL_DOMAIN;
}

export function validateFullName(value: string) {
  const name = value.trim();
  if (!name) return 'Full name is required.';
  if (name.length > AUTH_LIMITS.nameMax) {
    return `Full name must be ${AUTH_LIMITS.nameMax} characters or fewer.`;
  }
  if (!NAME_FORMAT.test(name)) {
    return 'Use letters, spaces, hyphens, or apostrophes only.';
  }
  return undefined;
}

export function validateLoginEmail(value: string) {
  const email = value.trim();
  if (!email) return 'Email is required.';
  if (email.length > AUTH_LIMITS.emailMax) {
    return `Email must be ${AUTH_LIMITS.emailMax} characters or fewer.`;
  }
  if (!EMAIL_FORMAT.test(email)) return 'Enter a valid email address.';
  if (!isStudentEmail(email) && !isStaffEmail(email)) {
    return `Use your @${STUDENT_EMAIL_DOMAIN} or @${STAFF_EMAIL_DOMAIN} email.`;
  }
  return undefined;
}

export function validateRegisterEmail(value: string) {
  const email = value.trim();
  if (!email) return 'Email is required.';
  if (email.length > AUTH_LIMITS.emailMax) {
    return `Email must be ${AUTH_LIMITS.emailMax} characters or fewer.`;
  }
  if (!EMAIL_FORMAT.test(email)) return 'Enter a valid email address.';
  if (!isStudentEmail(email)) {
    return `Email must end in @${STUDENT_EMAIL_DOMAIN}.`;
  }
  return undefined;
}

export function validateLoginPassword(value: string) {
  if (!value) return 'Password is required.';
  return undefined;
}

export function validateNewPassword(value: string) {
  if (!value) return 'Password is required.';
  if (value.length < AUTH_LIMITS.passwordMin) {
    return `Password must be at least ${AUTH_LIMITS.passwordMin} characters.`;
  }
  if (value.length > AUTH_LIMITS.passwordMax) {
    return `Password must be ${AUTH_LIMITS.passwordMax} characters or fewer.`;
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include at least one letter and one number.';
  }
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string) {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return undefined;
}
