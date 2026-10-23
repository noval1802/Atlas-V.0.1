import { describe, it, expect } from 'vitest';
import { imageType, isAllowed } from './route';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.alloc(8)]);

describe('imageType', () => {
  it('reads the type off the bytes', () => {
    // Every Singapore LTA frame arrives labelled application/octet-stream, with nosniff alongside.
    expect(imageType(jpeg)).toBe('image/jpeg');
    expect(imageType(png)).toBe('image/png');
  });

  it('refuses anything that is not a raster image, whatever the upstream calls it', () => {
    expect(imageType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'))).toBeNull();
    expect(imageType(Buffer.alloc(0))).toBeNull();
    expect(imageType(Buffer.alloc(2))).toBeNull();
  });
});

describe('isAllowed', () => {
  it('accepts listed camera hosts and their subdomains', () => {
    expect(isAllowed(new URL('https://cdn.skylinewebcams.com/live.jpg'))).toBe(true);
    expect(isAllowed(new URL('https://cctv-ss01.thb.gov.tw/T1-0K+000'))).toBe(true);
  });

  it('allows S3 for the TfL JamCams bucket only', () => {
    expect(isAllowed(new URL('https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.06514.jpg'))).toBe(true);
    expect(isAllowed(new URL('https://s3-eu-west-1.amazonaws.com/attacker-bucket/x.html'))).toBe(false);
    expect(isAllowed(new URL('https://attacker-bucket.s3-eu-west-1.amazonaws.com/x.html'))).toBe(false);
  });

  it('rejects other hosts, look-alikes, and non-http schemes', () => {
    expect(isAllowed(new URL('https://evil.example/x.jpg'))).toBe(false);
    expect(isAllowed(new URL('https://thb.gov.tw.evil.example/x.jpg'))).toBe(false);
    expect(isAllowed(new URL('ftp://cdn.skylinewebcams.com/x.jpg'))).toBe(false);
  });
});
