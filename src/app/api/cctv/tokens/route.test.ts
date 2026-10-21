import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const currentUser = vi.fn();
const updateStoredCctvToken = vi.fn();
const clearTptIndex = vi.fn();
const releaseCctvRegion = vi.fn();

vi.mock('@/lib/ops/current-user', () => ({ currentUser: () => currentUser() }));
vi.mock('@/lib/cctv-tokens', () => ({
  cctvTokenSource: (id: string) => id === 'jakarta'
    ? { id: 'jakarta', label: 'CCTV Jakarta', env: 'TPT_CCTV_TOKEN', region: 'tpt', hint: '' }
    : id === 'jasamarga'
      ? { id: 'jasamarga', label: 'CCTV Jasa Marga', env: 'JASAMARGA_WFS_TOKEN', region: 'jasamarga', hint: '' }
      : null,
  listCctvTokenStatus: () => [{ id: 'jakarta', label: 'CCTV Jakarta', hint: '', configured: true }],
  updateStoredCctvToken: (...args: unknown[]) => updateStoredCctvToken(...args),
}));
vi.mock('../tpt', () => ({ clearTptIndex: () => clearTptIndex() }));
vi.mock('../route', () => ({ releaseCctvRegion: (region: string) => releaseCctvRegion(region) }));

describe('cctv token route', () => {
  beforeEach(() => {
    currentUser.mockReset();
    updateStoredCctvToken.mockReset();
    clearTptIndex.mockReset();
    releaseCctvRegion.mockReset();
  });

  it('refuses a visitor who is not signed in', async () => {
    currentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('refuses a role that does not manage the system', async () => {
    for (const role of ['OPERATOR_PUSDALOPS', 'OPERATOR_KODAM', 'ANALYST', 'PIMPINAN']) {
      currentUser.mockResolvedValue({ role });
      const response = await GET();
      expect(response.status).toBe(403);
    }
    currentUser.mockResolvedValue({ role: 'ANALYST' });
    const response = await POST(new Request('http://localhost/api/cctv/tokens', {
      method: 'POST',
      body: JSON.stringify({ id: 'jakarta', token: 'abc' }),
    }));
    expect(response.status).toBe(403);
    expect(updateStoredCctvToken).not.toHaveBeenCalled();
  });

  it('lets an admin read token status', async () => {
    currentUser.mockResolvedValue({ role: 'ADMIN' });
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.sources[0]).toMatchObject({ id: 'jakarta', configured: true });
    expect(JSON.stringify(payload)).not.toMatch(/token/i);
  });

  it('stores a Jakarta token and drops that region cache', async () => {
    currentUser.mockResolvedValue({ role: 'SUPER_ADMIN' });
    updateStoredCctvToken.mockReturnValue({ ok: true });
    const response = await POST(new Request('http://localhost/api/cctv/tokens', {
      method: 'POST',
      body: JSON.stringify({ id: 'jakarta', token: 'fresh-token' }),
    }));
    expect(response.status).toBe(200);
    expect(updateStoredCctvToken).toHaveBeenCalledWith('jakarta', 'fresh-token');
    expect(clearTptIndex).toHaveBeenCalledOnce();
    expect(releaseCctvRegion).toHaveBeenCalledWith('tpt');
    expect(JSON.stringify(await response.json())).not.toContain('fresh-token');
  });
});
