export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone) {
  const re = /^[0-9]{10}$/;
  return re.test(String(phone ?? '').replace(/\D/g, ''));
}
