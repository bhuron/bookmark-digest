import { describe, it, expect } from '@jest/globals';
import { staticImageForEmbed } from '../embedImage.js';

describe('staticImageForEmbed', () => {
  it('should map a rendered Flourish iframe to its thumbnail', () => {
    const image = staticImageForEmbed(['https://flo.uri.sh/visualisation/30227229/embed?auto=1']);

    expect(image).toEqual({
      provider: 'flourish',
      id: '30227229',
      url: 'https://public.flourish.studio/visualisation/30227229/thumbnail'
    });
  });

  it('should map a Flourish wrapper that has not rendered yet', () => {
    const image = staticImageForEmbed(['visualisation/30226063?hideSignature']);

    expect(image && image.url).toBe('https://public.flourish.studio/visualisation/30226063/thumbnail');
  });

  it('should ignore an embed from another provider', () => {
    expect(staticImageForEmbed(['https://www.googletagmanager.com/ns.html?id=GTM-1'])).toBeNull();
    expect(staticImageForEmbed(['https://datawrapper.dwcdn.net/abc/1/'])).toBeNull();
  });

  it('should ignore a host that only looks like Flourish', () => {
    // Anchoring the host is what keeps a lookalike domain from being trusted
    expect(staticImageForEmbed(['https://flo.uri.sh.example.com/visualisation/1/embed'])).toBeNull();
    expect(staticImageForEmbed(['https://evil.com/x?u=https://flo.uri.sh/visualisation/1/embed'])).toBeNull();
  });

  it('should ignore empty and missing candidates', () => {
    expect(staticImageForEmbed([])).toBeNull();
    expect(staticImageForEmbed([null, undefined, '   '])).toBeNull();
    expect(staticImageForEmbed()).toBeNull();
  });

  it('should take the first candidate a provider claims', () => {
    const image = staticImageForEmbed([null, 'visualisation/42']);

    expect(image.id).toBe('42');
  });
});
