const path = require('path');

module.exports = (request, options) => {
  if (request.startsWith('@babel/runtime/')) {
    return require.resolve(request, {
      paths: [path.join(__dirname, 'node_modules')],
    });
  }

  if (request.startsWith('.') && options.basedir.includes('@babel+runtime@')) {
    return require.resolve(path.resolve(options.basedir, request));
  }

  return options.defaultResolver(request, options);
};
