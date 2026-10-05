if (process.env.CUP_SURVEY_SCRIPT_MODE !== '1') {
  require('server-only')
}

export function getBracketImpactTokenSecret(): string {
  const secret = process.env['BRACKET_IMPACT_TOKEN_SECRET']
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BRACKET_IMPACT_TOKEN_SECRET is required in production')
    }
    return 'dev-bracket-impact-token-secret'
  }
  return secret
}
