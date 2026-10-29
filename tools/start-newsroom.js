// Cross-platform entry point: collect immediately and every 30 minutes by default.
process.env.ATLAS_COLLECT_INTERVAL_MINUTES ||= '30';
await import('../server.js');
