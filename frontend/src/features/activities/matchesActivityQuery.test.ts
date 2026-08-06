import { matchesActivityQuery } from '@/features/activities/matchesActivityQuery'

const activity = { title: 'Gentle Yoga', venue: 'Bishan Community Club', tags: ['seated', 'low-impact'] }

describe('matchesActivityQuery', () => {
  it('matches everything when the query is blank', () => {
    expect(matchesActivityQuery(activity, '')).toBe(true)
    expect(matchesActivityQuery(activity, '   ')).toBe(true)
  })

  it('matches a substring of the activity name, case-insensitively', () => {
    expect(matchesActivityQuery(activity, 'gen')).toBe(true)
    expect(matchesActivityQuery(activity, 'GENTLE')).toBe(true)
  })

  it('matches a substring of the venue', () => {
    expect(matchesActivityQuery(activity, 'bishan')).toBe(true)
  })

  it('matches a tag', () => {
    expect(matchesActivityQuery(activity, 'low-impact')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(matchesActivityQuery(activity, 'swimming')).toBe(false)
  })
})
