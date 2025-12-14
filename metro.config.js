const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure these extensions are resolved properly
config.resolver.sourceExts.push('cjs');

module.exports = config;