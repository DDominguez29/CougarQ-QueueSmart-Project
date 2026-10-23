import { ApiError } from '../../shared/ApiError.ts';

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

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function invalid(message: string): never {
  throw new ApiError(400, 'VALIDATION_ERROR', message);
}

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    invalid('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

function requireString(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') {
    invalid(`${label} is required.`);
  }
  if (typeof value !== 'string') invalid(`${label} must be a string.`);
  return value;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string) {
  return normalizeEmail(email).split('@')[1] ?? '';
}

function checkEmail(value: unknown) {
  const email = normalizeEmail(requireString(value, 'Email'));
  if (!email) invalid('Email is required.');
  if (email.length > AUTH_LIMITS.emailMax) {
    invalid(`Email must be ${AUTH_LIMITS.emailMax} characters or fewer.`);
  }
  if (!EMAIL_FORMAT.test(email)) invalid('Email must be a valid email address.');
  return email;
}

export function validateRegister(body: unknown): RegisterInput {
  const data = requireObject(body);

  const fullName = requireString(data.fullName, 'Full name').trim();
  if (!fullName) invalid('Full name is required.');
  if (fullName.length > AUTH_LIMITS.nameMax) {
    invalid(`Full name must be ${AUTH_LIMITS.nameMax} characters or fewer.`);
  }
  if (!NAME_FORMAT.test(fullName)) {
    invalid('Full name may only contain letters, spaces, hyphens, periods, or apostrophes.');
  }

  const email = checkEmail(data.email);
  if (emailDomain(email) !== STUDENT_EMAIL_DOMAIN) {
    invalid(`Email must end in @${STUDENT_EMAIL_DOMAIN}.`);
  }

  const password = requireString(data.password, 'Password');
  if (password.length < AUTH_LIMITS.passwordMin) {
    invalid(`Password must be at least ${AUTH_LIMITS.passwordMin} characters.`);
  }
  if (password.length > AUTH_LIMITS.passwordMax) {
    invalid(`Password must be ${AUTH_LIMITS.passwordMax} characters or fewer.`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    invalid('Password must include at least one letter and one number.');
  }

  return { fullName, email, password };
}

export function validateLogin(body: unknown): LoginInput {
  const data = requireObject(body);
  const email = checkEmail(data.email);
  const domain = emailDomain(email);
  if (domain !== STUDENT_EMAIL_DOMAIN && domain !== STAFF_EMAIL_DOMAIN) {
    invalid(`Use your @${STUDENT_EMAIL_DOMAIN} or @${STAFF_EMAIL_DOMAIN} email.`);
  }

  const password = requireString(data.password, 'Password');
  if (password.length > AUTH_LIMITS.passwordMax) {
    invalid(`Password must be ${AUTH_LIMITS.passwordMax} characters or fewer.`);
  }

  return { email, password };
}
