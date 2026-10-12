/** Private threat queries always require a verified Mongo user identifier. */
function ownedThreatFilter(userId, threatId) {
  const owner = userId?.toString();
  if (!owner || !/^[a-f\d]{24}$/i.test(owner)) throw new Error('A verified threat owner is required');
  const filter = { user: owner };
  if (threatId !== undefined) {
    if (typeof threatId !== 'string' || !threatId || threatId.length > 128) throw new Error('Invalid threat identifier');
    if (/^[a-f\d]{24}$/i.test(threatId)) filter._id = threatId;
    else filter.threatId = threatId;
  }
  return filter;
}

module.exports = { ownedThreatFilter };
