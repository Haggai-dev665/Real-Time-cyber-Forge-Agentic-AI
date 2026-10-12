// A stand-in for a service module whose behaviour a test does not care about:
// any property access, call or construction returns the same inert object.
function anything() {
  const stub = new Proxy(function () {}, {
    get: (target, property) => (property === 'then' ? undefined : stub),
    apply: () => stub,
    construct: () => stub
  });
  return stub;
}

module.exports = { anything };
