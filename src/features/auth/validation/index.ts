import type { LoginValues, RegisterValues } from '../types'
export type FieldErrors<T> = Partial<Record<keyof T, string>>
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
export function passwordRules(value: string) {
  return [
    { label: 'Ít nhất 8 ký tự', valid: value.length >= 8 },
    { label: 'Có chữ hoa và chữ thường', valid: /[A-Z]/.test(value) && /[a-z]/.test(value) },
    { label: 'Có ít nhất một chữ số', valid: /\d/.test(value) },
  ]
}
export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {}
  if (!values.identity.trim()) errors.identity = 'Vui lòng nhập email hoặc tên đăng nhập.'
  else if (values.identity.includes('@') && !isEmail(values.identity)) errors.identity = 'Địa chỉ email chưa đúng định dạng.'
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.'
  return errors
}
export function validateRegister(values: RegisterValues): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {}
  if (values.displayName.trim().length < 2) errors.displayName = 'Tên hiển thị cần có ít nhất 2 ký tự.'
  else if (values.displayName.trim().length > 60) errors.displayName = 'Tên hiển thị không quá 60 ký tự.'
  if (!isEmail(values.email)) errors.email = 'Vui lòng nhập một địa chỉ email hợp lệ.'
  if (passwordRules(values.password).some(rule => !rule.valid)) errors.password = 'Mật khẩu cần đáp ứng cả 3 yêu cầu bên dưới.'
  if (!values.confirmPassword) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Hai mật khẩu chưa khớp nhau.'
  if (!values.acceptedTerms) errors.acceptedTerms = 'Vui lòng đồng ý với điều khoản để tiếp tục.'
  return errors
}
export function validateResetPassword(values: { password: string; confirmPassword: string }): { password?: string; confirmPassword?: string } {
  const errors: { password?: string; confirmPassword?: string } = {}
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu mới.'
  else if (passwordRules(values.password).some(rule => !rule.valid)) errors.password = 'Mật khẩu cần đáp ứng cả 3 yêu cầu bên dưới.'
  if (!values.confirmPassword) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Hai mật khẩu chưa khớp nhau.'
  return errors
}
