'use strict';

const { isMobile } = require('../../server/middleware/userAgent');

describe('isMobile', () => {
  it('detects iPhone', () => {
    expect(isMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true);
  });

  it('detects Android', () => {
    expect(isMobile('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36')).toBe(true);
  });

  it('detects Windows Phone', () => {
    expect(isMobile('Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0)')).toBe(true);
  });

  it('detects Opera Mini', () => {
    expect(isMobile('Opera/9.80 (Android; Opera Mini/12.0.1987)')).toBe(true);
  });

  it('detects iPod', () => {
    expect(isMobile('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)')).toBe(true);
  });

  it('does NOT detect desktop Chrome as mobile', () => {
    expect(isMobile('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
  });

  it('does NOT detect desktop Firefox as mobile', () => {
    expect(isMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0')).toBe(false);
  });

  it('does NOT detect iPad as mobile (not in pattern list)', () => {
    expect(isMobile('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isMobile('')).toBe(false);
  });

  it('is case-insensitive for patterns', () => {
    expect(isMobile('android device')).toBe(true);
    expect(isMobile('ANDROID device')).toBe(true);
  });
});
