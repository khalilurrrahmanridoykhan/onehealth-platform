import * as http from 'http';
import { URL } from 'url';
import { GeoStore, DEFAULT_ADMIN_GEO_PATH } from './geoStore';
import { CrosswalkStore, DEFAULT_CROSSWALK_PATH } from './crosswalkStore';
import {
  ApiResponse,
  handleCrosswalk,
  handleDistricts,
  handleDivisions,
  handleUnionByCode,
  handleUnions,
  handleUpazilas,
} from './api';

const PORT = Number(process.env.PORT ?? 4000);

const geo = GeoStore.fromFile(DEFAULT_ADMIN_GEO_PATH);
const crosswalk = CrosswalkStore.fromFile(DEFAULT_CROSSWALK_PATH);

function route(url: URL): ApiResponse {
  const parts = url.pathname.split('/').filter(Boolean); // e.g. ["geo", "union", "uni_100409109"]

  if (parts[0] !== 'geo') return { status: 404, body: { error: 'not found' } };

  if (parts.length === 2 && parts[1] === 'division') {
    return handleDivisions(geo);
  }
  if (parts.length === 2 && parts[1] === 'district') {
    return handleDistricts(geo, url.searchParams.get('division') ?? undefined);
  }
  if (parts.length === 2 && parts[1] === 'upazila') {
    return handleUpazilas(geo, url.searchParams.get('district') ?? undefined);
  }
  if (parts.length === 2 && parts[1] === 'union') {
    return handleUnions(geo, url.searchParams.get('upazila') ?? undefined);
  }
  if (parts.length === 3 && parts[1] === 'union') {
    return handleUnionByCode(geo, parts[2], url.searchParams.get('geometry') === 'full');
  }
  if (parts.length === 3 && parts[1] === 'crosswalk') {
    return handleCrosswalk(geo, crosswalk, parts[2]);
  }

  return { status: 404, body: { error: 'not found' } };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const { status, body } = route(url);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`bangladesh-geo-service listening on http://localhost:${PORT}`);
  });
}

export { server };
