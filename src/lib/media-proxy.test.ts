import { describe, expect, it } from 'vitest';
import { mediaHeaders, mediaType } from './media-proxy';

describe('mediaType', () => {
  it('keeps real media types', () => {
    expect(mediaType('video/MP2T')).toBe('video/mp2t');
    expect(mediaType('video/mp4; codecs="avc1"')).toBe('video/mp4');
    expect(mediaType('application/vnd.apple.mpegurl')).toBe('application/vnd.apple.mpegurl');
  });

  it('turns anything a browser could run into opaque bytes', () => {
    for (const hostile of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/javascript', 'application/xml', '', null]) {
      expect(mediaType(hostile)).toBe('application/octet-stream');
    }
  });
});

describe('mediaHeaders', () => {
  it('forbids sniffing', () => {
    const headers = mediaHeaders('text/html');
    expect(headers['Content-Type']).toBe('application/octet-stream');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
