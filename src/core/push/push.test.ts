import { describe, expect, it } from 'vitest'
import { decodeKey, deviceLabel } from './push'

describe('push', () => {
  it('décode une clé VAPID base64url', () => {
    expect([...decodeKey('AQIDBA')]).toEqual([1, 2, 3, 4])
    expect([...decodeKey('-_8')]).toEqual([251, 255])
  })

  it('nomme l’appareil', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Android, Chrome')
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone, Safari')
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Mac, Firefox')
  })
})
