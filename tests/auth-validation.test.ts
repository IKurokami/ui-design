import { describe, expect, it } from 'vitest'
import { isEmail, validateLogin, validateRegister } from '../src/features/auth/validation'
import { authService } from '../src/features/auth/services/auth.service'
import { IntegrationUnavailableError } from '../src/services/error-handler'
const valid = { displayName: 'Người đọc', email: 'reader@example.com', password: 'Reading123', confirmPassword: 'Reading123', acceptedTerms: true }
describe('authentication validation', () => {
  it('allows username login without treating it as email', () => expect(validateLogin({ identity: 'reader', password: 'x', remember: false })).toEqual({}))
  it('reports empty login fields separately', () => expect(Object.keys(validateLogin({ identity: '', password: '', remember: true }))).toEqual(['identity', 'password']))
  it('rejects malformed emails and trims valid email input', () => {
    expect(isEmail('reader@')).toBe(false)
    expect(isEmail(' reader@example.com ')).toBe(true)
    expect(validateLogin({ identity: 'reader@', password: 'x', remember: false }).identity).toBeTruthy()
  })
  it('accepts a valid registration', () => expect(validateRegister(valid)).toEqual({}))
  it('requires every strength rule', () => {
    for (const password of ['Short1', 'alllower123', 'ALLUPPER123', 'NoDigitsHere']) expect(validateRegister({ ...valid, password }).password).toBeTruthy()
  })
  it('requires matching passwords', () => expect(validateRegister({ ...valid, confirmPassword: 'Reading124' }).confirmPassword).toBeTruthy())
  it('requires consent', () => expect(validateRegister({ ...valid, acceptedTerms: false }).acceptedTerms).toBeTruthy())
  it('does not fake authentication when there is no backend', async () => {
    await expect(authService.login({ identity: 'reader', password: 'Reading123', remember: false })).rejects.toBeInstanceOf(IntegrationUnavailableError)
    await expect(authService.register(valid)).rejects.toBeInstanceOf(IntegrationUnavailableError)
    await expect(authService.requestPasswordReset(valid.email)).rejects.toBeInstanceOf(IntegrationUnavailableError)
  })
})

