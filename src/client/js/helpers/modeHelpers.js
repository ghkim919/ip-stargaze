export function isLiveMode(config) {
  return config.mode === 'live' || config.mode === 'capture';
}
