const mapboxPluginModule = require("./node_modules/@rnmapbox/maps/app.plugin.js");
const withMapbox = mapboxPluginModule.default || mapboxPluginModule;
const { readPublicRuntimeEnv } = require("./scripts/sync-runtime-public-env");

function assignExtraValues(target, keys, value) {
	for (const key of keys) {
		target[key] = value;
	}
}

module.exports = function withPinnedMapboxVersion(config) {
	const publicEnv = readPublicRuntimeEnv(__dirname);
	const runtimeMapboxToken = publicEnv.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
	const nextConfig = {
		...config,
		extra: {
			...(config.extra || {}),
		},
	};

	if (runtimeMapboxToken) {
		assignExtraValues(nextConfig.extra, ["mapboxAccessToken", "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN", "MAPBOX_ACCESS_TOKEN"], runtimeMapboxToken);
		nextConfig.ios = {
			...(nextConfig.ios || {}),
			infoPlist: {
				...((nextConfig.ios && nextConfig.ios.infoPlist) || {}),
				MBXAccessToken: runtimeMapboxToken,
				MGLMapboxAccessToken: runtimeMapboxToken,
			},
		};
	}

	const extraMappings = [
		["EXPO_PUBLIC_API_BASE_URL", ["apiBaseUrl", "EXPO_PUBLIC_API_BASE_URL"]],
		["EXPO_PUBLIC_IOS_PUSH_ENABLED", ["iosPushEnabled", "EXPO_PUBLIC_IOS_PUSH_ENABLED"]],
		["EXPO_PUBLIC_METER_INCLUDED_KM", ["meterIncludedKm", "EXPO_PUBLIC_METER_INCLUDED_KM"]],
		["EXPO_PUBLIC_OPERATOR_PHONE", ["operatorPhone", "EXPO_PUBLIC_OPERATOR_PHONE"]],
		["EXPO_PUBLIC_OSRM_BASE_URL", ["osrmBaseUrl", "EXPO_PUBLIC_OSRM_BASE_URL"]],
	];

	for (const [envKey, extraKeys] of extraMappings) {
		const value = publicEnv[envKey];
		if (!value) continue;
		assignExtraValues(nextConfig.extra, extraKeys, value);
	}

	return withMapbox(nextConfig, {
		// Mapbox iOS 11.16.x already requires Xcode 16.2.
		// Keep the downgrade copy on the last 10.x branch that still supports Xcode 13.
		RNMapboxMapsVersion: "10.13.1",
	});
};