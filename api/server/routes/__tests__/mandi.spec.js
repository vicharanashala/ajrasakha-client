const express = require('express');
const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

// Signed in farmer used by the mocked auth middleware. Tests can clear the location.
let mockUser;

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = mockUser;
    next();
  },
}));

const MANDI_ID = '6a42036c9596217d979efc1f';

// Builds an app with only the mandi routes mounted, like the real server.
const createApp = () => {
  const app = express();
  app.use('/api/mandi', require('../mandi'));
  return app;
};

describe('mandi routes', () => {
  beforeEach(() => {
    process.env.AGENT_HOST_IP = '10.0.0.5';
    delete process.env.MANDI_SERVICE_URL;
    delete process.env.PROXY;
    mockUser = { farmerProfile: { location: { latitude: 30.4811, longitude: 75.0932 } } };
  });

  it('proxies nearby mandis with the farmer location and maps the response', async () => {
    axios.get.mockResolvedValue({
      data: {
        data: [{ id: 'abc', name: 'jaitu apmc', distance_km: 20.5, updated_time: null, extra: 1 }],
        pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
      },
    });

    const res = await request(createApp()).get('/api/mandi/nearby?search=jai&page=1');

    expect(res.status).toBe(200);
    expect(axios.get).toHaveBeenCalledWith(
      'http://10.0.0.5:8000/v1/mandis/nearby',
      expect.objectContaining({
        params: { lat: 30.4811, lng: 75.0932, radius_km: 40, page: 1, limit: 20, search: 'jai' },
      }),
    );
    expect(res.body).toEqual({
      data: [{ id: 'abc', name: 'jaitu apmc', distanceKm: 20.5, updatedDate: null }],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it('uses MANDI_SERVICE_URL when it is set', async () => {
    process.env.MANDI_SERVICE_URL = 'http://mandi.internal/';
    axios.get.mockResolvedValue({ data: { data: [], pagination: {} } });

    await request(createApp()).get('/api/mandi/nearby');

    expect(axios.get.mock.calls[0][0]).toBe('http://mandi.internal/v1/mandis/nearby');
  });

  it('returns 404 when the farmer has no saved location', async () => {
    mockUser = { farmerProfile: {} };
    const res = await request(createApp()).get('/api/mandi/nearby');
    expect(res.status).toBe(404);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('rejects invalid paging and radius values', async () => {
    const app = createApp();
    expect((await request(app).get('/api/mandi/nearby?limit=500')).status).toBe(400);
    expect((await request(app).get('/api/mandi/nearby?radius_km=0')).status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('maps mandi prices and falls back to crop sort for unknown values', async () => {
    axios.get.mockResolvedValue({
      data: {
        data: [
          {
            product_id: 'p1',
            crop: 'onion',
            variety: 'other',
            unit: 'Rs/quintal',
            modal: 4000,
            max: 4000,
            min: 4000,
            price_date: '2026-11-17',
            age_days: 0,
            stale: false,
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
      },
    });

    const res = await request(createApp()).get(`/api/mandi/${MANDI_ID}/prices?sort=bogus`);

    expect(res.status).toBe(200);
    expect(axios.get).toHaveBeenCalledWith(
      `http://10.0.0.5:8000/v1/mandi/${MANDI_ID}/prices/nearby`,
      expect.objectContaining({ params: { sort: 'crop', page: 1, limit: 20 } }),
    );
    expect(res.body.data[0]).toEqual({
      productId: 'p1',
      crop: 'onion',
      variety: 'other',
      unit: 'Rs/quintal',
      modal: 4000,
      max: 4000,
      min: 4000,
      priceDate: '2026-11-17',
      ageDays: 0,
      stale: false,
    });
  });

  it('rejects mandi ids that are not object ids', async () => {
    const res = await request(createApp()).get('/api/mandi/..%2Fadmin/prices');
    expect(res.status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('hides upstream failures behind a generic 502', async () => {
    axios.get.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    const res = await request(createApp()).get(`/api/mandi/${MANDI_ID}/prices`);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ message: 'Mandi prices are unavailable right now' });
  });
});
