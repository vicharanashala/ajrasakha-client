const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { geocodeWithMeta, cleanPart } = require('../server/utils/geocoding');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) ?? '').split('=')[1]) || 0;
const DELAY_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FATAL = new Set(['REQUEST_DENIED', 'INVALID_REQUEST', 'NO_KEY']);

// "No usable coordinates": missing, null, {}, only one of the two, or a non-number
const INVALID_LOCATION = [
  { 'farmerProfile.location.latitude': { $not: { $type: 'number' } } },
  { 'farmerProfile.location.longitude': { $not: { $type: 'number' } } },
];

const lookup = async (place) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await geocodeWithMeta(place);
    } catch (e) {
      if (e.status === 'OVER_QUERY_LIMIT' && attempt < 3) {
        await sleep(2000 * attempt);
        continue;
      }
      throw e;
    }
  }
};

(async () => {
  console.log('Mongo URI:', process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection('users');

  let cursor = users.find(
    { farmerProfile: { $type: 'object' }, $or: INVALID_LOCATION },
    { projection: { farmerProfile: 1 } },
  );
  if (LIMIT) cursor = cursor.limit(LIMIT);
  const docs = await cursor.toArray();

  const cache = new Map();
  const stats = {
    matched: docs.length,
    updated: 0,
    failed: 0,
    raced: 0,
    noPlaceData: 0,
    skippedNoState: 0,
    partialMatch: 0,
    stateMismatch: 0,
    byLevel: { village: 0, block: 0, district: 0, state: 0 },
  };
  let fatal = null;

  for (const user of docs) {
    const p = user.farmerProfile ?? {};
    const place = {
      villageName: cleanPart(p.villageName),
      blockName: cleanPart(p.blockName),
      district: cleanPart(p.district),
      state: cleanPart(p.state),
    };
    const complete = place.state && place.district && place.blockName && place.villageName;
    if (!complete) {
      stats.incomplete = (stats.incomplete ?? 0) + 1; // the popup will ask these users
      continue;
    }

    const key = JSON.stringify(place);
    try {
      if (!cache.has(key)) {
        cache.set(key, await lookup(place));
        await sleep(DELAY_MS);
      }
      const geo = cache.get(key);

      if (!geo) {
        stats.failed++;
        console.log(`FAILED  ${user._id}`, place);
        continue;
      }

      stats.byLevel[geo.level]++;
      if (geo.partialMatch) stats.partialMatch++;
      if (geo.stateMismatch) stats.stateMismatch++;
      const flags = [geo.partialMatch && 'partial-match', geo.stateMismatch && 'state-mismatch']
        .filter(Boolean)
        .join(',');

      if (!DRY_RUN) {
        // Same invalid-location condition again, so a user who saved in the meantime is not overwritten
        const r = await users.updateOne(
          { _id: user._id, $or: INVALID_LOCATION },
          {
            $set: {
              'farmerProfile.location': { latitude: geo.latitude, longitude: geo.longitude },
            },
          },
        );
        if (r.modifiedCount === 0) {
          stats.raced++;
          continue;
        }
      }
      stats.updated++;
      console.log(
        `${DRY_RUN ? 'WOULD SET' : 'SET'}  ${user._id}  level=${geo.level}${flags ? ` [${flags}]` : ''}`,
        { latitude: geo.latitude, longitude: geo.longitude },
        `<- ${geo.address}`,
      );
    } catch (err) {
      if (FATAL.has(err.status)) {
        fatal = err;
        break; // key/config problem: continuing would mark everyone as failed
      }
      stats.failed++;
      console.error(`ERROR   ${user._id}`, err.message);
    }
  }

  console.log('\nSummary', JSON.stringify(stats, null, 2), `dryRun=${DRY_RUN}`);
  if (fatal) console.error(`\nStopped early: ${fatal.status} - ${fatal.message}`);
  await mongoose.disconnect();
  process.exit(fatal ? 1 : 0);
})();
