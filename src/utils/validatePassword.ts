export default function validatePassword(password: string) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasNoSpaces = !/\s/.test(password);
  
    if (password.length < minLength) return { valid: false, message: 'Password must be at least 6 characters long.' };
    if (!hasUpperCase) return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    if (!hasLowerCase) return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    if (!hasDigit) return { valid: false, message: 'Password must contain at least one digit.' };
    if (!hasNoSpaces) return { valid: false, message: 'Password must not contain any spaces.' };
    return { valid: true, message: 'Password is valid.' };
}