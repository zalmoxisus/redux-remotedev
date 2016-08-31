if (process.env.NODE_ENV === 'production') {
  module.exports = require('./enhancer').default; // eslint-disable-line global-require
} else {
  module.exports = () => noop => noop;
}
