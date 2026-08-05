import { listActivities } from '@/services/api'

describe('listActivities', () => {
  it('maps API data into the frontend model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ activities: [{ id: 7, name: 'Garden walk', location: 'Bishan Park', start_at: '2030-01-01T01:00:00Z', cost: 0, tags: ['Gentle'] }] }), { status: 200 })))
    const activities = await listActivities({ location: 'Bishan', limit: 5 })
    expect(activities[0]).toMatchObject({ id: '7', title: 'Garden walk', venue: 'Bishan Park', cost: 0, tags: ['Gentle'] })
    expect(fetch).toHaveBeenCalledWith('/api/activities?limit=5&location=Bishan', expect.any(Object))
  })
  it('throws a typed error for unsuccessful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(listActivities()).rejects.toEqual(expect.objectContaining({ status: 503 }))
  })
  it('rejects malformed data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ activities: [{ id: 1 }] }), { status: 200 })))
    await expect(listActivities()).rejects.toThrow(/unexpected response/i)
  })
})
