// An in-memory stand-in for a Mongoose model: enough of the interface for the
// workspace service, the migrations and the auth controller, with unique
// indexes that fail the way the database's do (error code 11000).
//
//   const User = fakeCollection({ unique: [{ fields: ['email'] }] });
//   await User.create({ email: 'a@example.org' });
//   const user = new User({ email: 'b@example.org' }); await user.save();
//
// Supported: create, findOne, findById, find (with select/sort/skip/limit and
// cursor), updateOne (with $set, $inc, $setOnInsert and upsert), updateMany
// ($set), findOneAndUpdate, deleteOne, deleteMany, countDocuments, and
// instance save().
// Filters are equality on (dotted) fields, plus $in, $regex, $gte, $lte and $exists.

let counter = 0;
const nextId = () => (++counter).toString(16).padStart(24, '0');

const valueAt = (doc, field) => field.split('.').reduce((value, part) => (value == null ? undefined : value[part]), doc);

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([field, expected]) => {
    const actual = valueAt(doc, field);
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
      const operators = Object.keys(expected);
      if (operators.length && operators.every(op => op.startsWith('$'))) {
        return operators.every(op => {
          const target = expected[op];
          if (op === '$in') return target.map(String).includes(String(actual));
          if (op === '$regex') return actual != null && new RegExp(target).test(String(actual));
          if (op === '$gte') return actual != null && new Date(actual) >= new Date(target);
          if (op === '$lte') return actual != null && new Date(actual) <= new Date(target);
          // numbers compare as numbers here too: new Date(n) is n milliseconds
          if (op === '$gt') return actual != null && new Date(actual) > new Date(target);
          if (op === '$lt') return actual != null && new Date(actual) < new Date(target);
          if (op === '$ne') return actual == null ? target != null : String(actual) !== String(target);
          if (op === '$exists') return (actual !== undefined) === Boolean(target);
          throw new Error(`fakeCollection does not support ${op}`);
        });
      }
    }
    if (expected == null) return actual == null;
    return actual != null && String(actual) === String(expected);
  });
}

/** What Mongoose returns from find/findOne: awaitable, and chainable enough. */
function query(result) {
  let items = Array.isArray(result) ? [...result] : null;
  const current = () => (items === null ? result : items);
  return {
    select() { return this; },
    lean() { return this; },
    sort(order = {}) {
      const [[field, direction] = []] = Object.entries(order);
      if (items && field) items.sort((a, b) => String(valueAt(a, field)).localeCompare(String(valueAt(b, field))) * (direction < 0 ? -1 : 1));
      return this;
    },
    skip(count) { if (items) items = items.slice(count); return this; },
    limit(count) { if (items) items = items.slice(0, count); return this; },
    then(resolve, reject) { return Promise.resolve(current()).then(resolve, reject); },
    cursor() {
      const list = items || [];
      return { async* [Symbol.asyncIterator]() { for (const item of [...list]) yield item; } };
    }
  };
}

/** $set, with dotted paths ("a.b") written into nested objects. */
function setFields(doc, set) {
  for (const [field, value] of Object.entries(set)) {
    const parts = field.split('.');
    let target = doc;
    for (const part of parts.slice(0, -1)) target = target[part] && typeof target[part] === 'object' ? target[part] : (target[part] = {});
    target[parts[parts.length - 1]] = value;
  }
}

function fakeCollection({ unique = [], methods = {} } = {}) {
  const docs = [];

  function Model(fields = {}) {
    Object.assign(this, fields);
  }
  Object.assign(Model.prototype, methods);

  function assertUnique(candidate) {
    for (const index of unique) {
      if (index.where && !index.where(candidate)) continue;
      if (index.fields.some(field => valueAt(candidate, field) == null)) continue; // sparse
      const clash = docs.find(other => other !== candidate && (!index.where || index.where(other)) &&
        index.fields.every(field => String(valueAt(other, field)) === String(valueAt(candidate, field))));
      if (clash) throw Object.assign(new Error(`E11000 duplicate key: ${index.fields.join(', ')}`), { code: 11000 });
    }
  }

  Model.prototype.save = async function save() {
    if (!this._id) this._id = nextId();
    assertUnique(this);
    if (!docs.includes(this)) docs.push(this);
    return this;
  };

  Model.docs = docs;
  Model.reset = () => { docs.length = 0; };
  Model.create = async fields => new Model(fields).save();
  Model.findOne = filter => query(docs.find(doc => matches(doc, filter)) || null);
  Model.findById = id => query(docs.find(doc => String(doc._id) === String(id)) || null);
  Model.find = filter => query(docs.filter(doc => matches(doc, filter)));
  Model.countDocuments = async filter => docs.filter(doc => matches(doc, filter)).length;
  Model.deleteOne = async filter => {
    const index = docs.findIndex(doc => matches(doc, filter));
    if (index === -1) return { deletedCount: 0 };
    docs.splice(index, 1);
    return { deletedCount: 1 };
  };
  Model.deleteMany = async filter => {
    const keep = docs.filter(doc => !matches(doc, filter));
    const deletedCount = docs.length - keep.length;
    docs.length = 0;
    docs.push(...keep);
    return { deletedCount };
  };
  Model.updateOne = async (filter, update = {}, options = {}) => {
    const found = docs.find(doc => matches(doc, filter));
    if (found) {
      setFields(found, update.$set || {});
      for (const [field, by] of Object.entries(update.$inc || {})) found[field] = (Number(found[field]) || 0) + by;
      applyPush(found, update.$push);
      assertUnique(found);
      return { matchedCount: 1, upsertedCount: 0 };
    }
    if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
    await Model.create({ ...filter, ...(update.$setOnInsert || {}), ...(update.$set || {}) });
    return { matchedCount: 0, upsertedCount: 1 };
  };
  Model.updateMany = async (filter, update = {}) => {
    const found = docs.filter(doc => matches(doc, filter));
    for (const doc of found) Object.assign(doc, update.$set || {});
    return { matchedCount: found.length, modifiedCount: found.length };
  };
  // $push of one value, or { $each, $slice } (a negative $slice keeps the last n)
  function applyPush(doc, push = {}) {
    for (const [field, value] of Object.entries(push)) {
      const list = Array.isArray(doc[field]) ? doc[field] : (doc[field] = []);
      if (value && typeof value === 'object' && Array.isArray(value.$each)) {
        list.push(...value.$each);
        if (typeof value.$slice === 'number') doc[field] = value.$slice < 0 ? list.slice(value.$slice) : list.slice(0, value.$slice);
      } else list.push(value);
    }
  }
  // Match and change happen with no await in between, so, as in MongoDB, two
  // concurrent calls cannot both match the same document's old state.
  Model.findOneAndUpdate = (filter, update = {}) => {
    const found = docs.find(doc => matches(doc, filter));
    if (found) {
      setFields(found, update.$set || {});
      for (const [field, by] of Object.entries(update.$inc || {})) found[field] = (Number(found[field]) || 0) + by;
      applyPush(found, update.$push);
      assertUnique(found);
    }
    return query(found || null);
  };
  return Model;
}

module.exports = { fakeCollection, nextId };
