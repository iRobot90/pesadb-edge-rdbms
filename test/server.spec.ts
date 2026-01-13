import request from 'supertest';
import { expect } from 'chai';
import app from '../src/server/index';
import { apiKeyStore } from '../src/server/apiKeyStore';

describe('API (integration)', () => {
  let testKey: string;
  let keyId: string;

  before(() => {
    // Create a temporary key for testing
    const created = apiKeyStore.create('user');
    testKey = created.token;
    keyId = created.id;
  });

  after(() => {
    // Cleanup
    if (keyId) apiKeyStore.revoke(keyId);
  });

  it('GET /api/transactions returns 200 with API key', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('x-api-key', testKey);

    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
  });
});