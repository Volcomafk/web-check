const dns = require('dns');
const util = require('util');
const middleware = require('./_common/middleware');
const { withCache } = require('./_common/cache');

// Cache DNS lookups for 10 minutes to improve efficiency
const DNS_CACHE_TTL = 600000; // 10 minutes

const handler = async (url) => {
  let hostname = url;

  // Handle URLs by extracting hostname
  if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
    hostname = new URL(hostname).hostname;
  }

  try {
    const lookupPromise = util.promisify(dns.lookup);
    const resolve4Promise = util.promisify(dns.resolve4);
    const resolve6Promise = util.promisify(dns.resolve6);
    const resolveMxPromise = util.promisify(dns.resolveMx);
    const resolveTxtPromise = util.promisify(dns.resolveTxt);
    const resolveNsPromise = util.promisify(dns.resolveNs);
    const resolveCnamePromise = util.promisify(dns.resolveCname);
    const resolveSoaPromise = util.promisify(dns.resolveSoa);
    const resolveSrvPromise = util.promisify(dns.resolveSrv);
    const resolvePtrPromise = util.promisify(dns.resolvePtr);

    // Wrap DNS functions with caching for efficiency
    const cachedLookup = withCache(lookupPromise, 'dns_lookup', DNS_CACHE_TTL);
    const cachedResolve4 = withCache(resolve4Promise, 'dns_resolve4', DNS_CACHE_TTL);
    const cachedResolve6 = withCache(resolve6Promise, 'dns_resolve6', DNS_CACHE_TTL);
    const cachedResolveMx = withCache(resolveMxPromise, 'dns_resolveMx', DNS_CACHE_TTL);
    const cachedResolveTxt = withCache(resolveTxtPromise, 'dns_resolveTxt', DNS_CACHE_TTL);
    const cachedResolveNs = withCache(resolveNsPromise, 'dns_resolveNs', DNS_CACHE_TTL);
    const cachedResolveCname = withCache(resolveCnamePromise, 'dns_resolveCname', DNS_CACHE_TTL);
    const cachedResolveSoa = withCache(resolveSoaPromise, 'dns_resolveSoa', DNS_CACHE_TTL);
    const cachedResolveSrv = withCache(resolveSrvPromise, 'dns_resolveSrv', DNS_CACHE_TTL);
    const cachedResolvePtr = withCache(resolvePtrPromise, 'dns_resolvePtr', DNS_CACHE_TTL);

    const [a, aaaa, mx, txt, ns, cname, soa, srv, ptr] = await Promise.all([
      cachedLookup(hostname),
      cachedResolve4(hostname).catch(() => []), // A record
      cachedResolve6(hostname).catch(() => []), // AAAA record
      cachedResolveMx(hostname).catch(() => []), // MX record
      cachedResolveTxt(hostname).catch(() => []), // TXT record
      cachedResolveNs(hostname).catch(() => []), // NS record
      cachedResolveCname(hostname).catch(() => []), // CNAME record
      cachedResolveSoa(hostname).catch(() => []), // SOA record
      cachedResolveSrv(hostname).catch(() => []), // SRV record
      cachedResolvePtr(hostname).catch(() => [])  // PTR record
    ]);

    return {
      A: a,
      AAAA: aaaa,
      MX: mx,
      TXT: txt,
      NS: ns,
      CNAME: cname,
      SOA: soa,
      SRV: srv,
      PTR: ptr
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = middleware(handler);
module.exports.handler = middleware(handler);
