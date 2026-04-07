const mapboxPluginModule = require("./node_modules/@rnmapbox/maps/app.plugin.js");
const withMapbox = mapboxPluginModule.default || mapboxPluginModule;

module.exports = function withPinnedMapboxVersion(config) {
	return withMapbox(config, {
		// Mapbox iOS 11.16.x already requires Xcode 16.2.
		// Keep the downgrade copy on the last 10.x branch that still supports Xcode 13.
		RNMapboxMapsVersion: "10.13.1",
	});
};