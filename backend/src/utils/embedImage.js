/**
 * Static renders of chart embeds.
 *
 * A chart delivered as an <iframe> cannot survive this pipeline. Readability's
 * _prepArticle calls _clean(articleContent, "iframe"), which deletes every iframe
 * inside the article body, and an iframe would not render on a Kindle anyway. The
 * providers below publish a server-rendered image of the same visualisation, so
 * swapping the embed for that image keeps the chart through extraction,
 * sanitising and download - and it renders in the reader and in an EPUB.
 *
 * Hosts and paths are matched exactly. A wrong guess would replace a working
 * embed with a broken image, which is worse than the embed being dropped, so an
 * unrecognised provider is left alone.
 */

// <iframe src="https://flo.uri.sh/visualisation/30227229/embed?auto=1">
const FLOURISH_IFRAME = /^https?:\/\/flo\.uri\.sh\/visualisation\/(\d+)\/embed(?:[/?#]|$)/i;

// <div class="flourish-embed" data-src="visualisation/30227229?hideSignature">
const FLOURISH_DATA_SRC = /^visualisation\/(\d+)(?:[/?#]|$)/i;

/**
 * The static image standing in for a chart embed
 *
 * @param {(string|null|undefined)[]} candidates - Sources to try, most specific first
 *   (an iframe src, then the wrapper's data-src)
 * @returns {{provider: string, id: string, url: string}|null} - Null when no
 *   known provider claims any of the candidates
 */
export function staticImageForEmbed(candidates = []) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const value = candidate.trim();

    if (!value) {
      continue;
    }

    const flourish = value.match(FLOURISH_IFRAME) || value.match(FLOURISH_DATA_SRC);

    if (flourish) {
      const id = flourish[1];

      return {
        provider: 'flourish',
        id,
        // Flourish renders this at a fixed 1020px wide and ignores a width
        // parameter, which is close to the 1200px the pipeline keeps anyway
        url: `https://public.flourish.studio/visualisation/${id}/thumbnail`
      };
    }
  }

  return null;
}

export default { staticImageForEmbed };
