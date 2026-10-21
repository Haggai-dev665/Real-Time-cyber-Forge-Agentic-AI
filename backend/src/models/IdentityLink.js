/**
 * IdentityLink: which account an outside identity belongs to.
 *
 * The internal account ID (the User document's `_id`) is the one identity the
 * backend reasons about, and it never changes. Everything else that can name a
 * person (the Appwrite user created at registration, a Firebase user, a Google
 * account) is mapped to it here, in one place, by the provider's own stable
 * subject ID.
 *
 * An email address is not an identity. Two providers agreeing on an address
 * does not make two accounts the same, so nothing in this collection is keyed
 * by email, and no link is created because an address matched.
 */
const mongoose = require('mongoose');

const PROVIDERS = ['appwrite', 'firebase', 'google'];

const identityLinkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: PROVIDERS, required: true },
  subject: { type: String, required: true, trim: true, maxlength: 256 },
  // how the link came to exist: at registration, at a verified sign-in, or by a migration
  source: { type: String, enum: ['registration', 'sign-in', 'migration'], required: true }
}, { timestamps: true });

// A provider's subject maps to one account, enforced by the database.
identityLinkSchema.index({ provider: 1, subject: 1 }, { unique: true });
identityLinkSchema.index({ userId: 1, provider: 1 });

module.exports = mongoose.model('IdentityLink', identityLinkSchema);
module.exports.PROVIDERS = PROVIDERS;
