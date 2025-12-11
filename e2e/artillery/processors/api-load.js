/**
 * Artillery processor for direct API load (HTTP engine).
 * Generates unique users and room names per VU iteration.
 */
module.exports = {
  setUser,
};

function setUser(context, events, done) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  context.vars.email = `api_load_${id}@example.com`;
  context.vars.password = 'Password123!';
  context.vars.name = `API Load ${id}`;
  context.vars.roomSuffix = id;
  return done();
}
