import { normalizeValidatedInput } from './normalize-input'

describe('normalizeValidatedInput', () => {
  it('trims form text and normalizes common identifiers', () => {
    expect(
      normalizeValidatedInput({
        name: '  Priya  Sharma  ',
        email: '  PRIYA@EXAMPLE.COM ',
        mobile: ' +91 (98765) 43210 ',
        gstin: ' 29abcde1234f1z5 ',
        nested: { address: '  Civil Lines  ' },
      }),
    ).toEqual({
      name: 'Priya  Sharma',
      email: 'priya@example.com',
      mobile: '+919876543210',
      gstin: '29ABCDE1234F1Z5',
      nested: { address: 'Civil Lines' },
    })
  })

  it('does not alter passwords or tokens', () => {
    expect(
      normalizeValidatedInput({
        password: '  Password With Spaces  ',
        refreshToken: '  token-value  ',
      }),
    ).toEqual({
      password: '  Password With Spaces  ',
      refreshToken: '  token-value  ',
    })
  })
})
