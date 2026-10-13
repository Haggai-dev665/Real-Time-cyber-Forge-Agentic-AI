// Query parameters that carry a credential. Their values are replaced before a
// URL is written to a log.
const CREDENTIAL_PARAMETERS = /([?&](?:token|ticket|access_token|id_token|api_key|apikey|key|password|secret)=)[^&#\s]*/gi;

function redactUrl(url) {
  return String(url == null ? '' : url).replace(CREDENTIAL_PARAMETERS, '$1[redacted]');
}

module.exports = { redactUrl };
