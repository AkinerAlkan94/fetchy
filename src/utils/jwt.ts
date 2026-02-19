// JWT Token utilities

export interface DecodedJWT {
  header: Record<string, any>;
  payload: Record<string, any>;
  signature: string;
  raw: string;
}

// Check if a string is a JWT token
export const isJWT = (value: string): boolean => {
  // JWT has exactly 3 parts separated by dots
  const parts = value.split('.');
  if (parts.length !== 3) return false;

  // Each part should be base64url encoded (alphanumeric, -, _, no padding or with = padding)
  const base64UrlPattern = /^[A-Za-z0-9_-]+={0,2}$/;
  return parts.every(part => base64UrlPattern.test(part));
};

// Decode base64url
const base64UrlDecode = (str: string): string => {
  // Replace base64url characters with base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Pad with = to make length a multiple of 4
  while (base64.length % 4) {
    base64 += '=';
  }

  try {
    // Decode base64 and handle UTF-8
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return atob(base64);
  }
};

// Decode JWT token
export const decodeJWT = (token: string): DecodedJWT | null => {
  try {
    if (!isJWT(token)) return null;

    const parts = token.split('.');
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const signature = parts[2];

    return {
      header,
      payload,
      signature,
      raw: token,
    };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

// Format timestamp for JWT dates
export const formatJWTDate = (timestamp: number): string => {
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

// Check if JWT is expired
export const isJWTExpired = (payload: Record<string, any>): boolean => {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
};
