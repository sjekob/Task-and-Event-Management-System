// The MVC core (models, services, controllers) lives in ../shared and is
// bundled straight from source, so Metro must watch that folder too.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, '../shared');

config.watchFolders = [...(config.watchFolders ?? []), shared];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { '@shared': path.join(shared, 'src') };

module.exports = config;
