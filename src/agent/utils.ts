import { randomUUID } from 'node:crypto';
import { readFileSync } from 'fs';
import { resolve as resolveDns } from 'dns';

export function generateTaskId(): string {
  return randomUUID();
}

export function getPortFromUrl(url: string): number {
  let _url = new URL(url);
  return parseInt(_url.port);
}

export function getListenIpAddressFromUrl(url: string): string {
  /* If the agent is publicly accessible, the URL will have the following format:
   * <http|https>://FQDN:[<port>][/uri]
   *
   * This means the FQDN (Fully Qualified Domain Name) will contain
   * a host and a domain part, or at least a domain.tld (top-level domain) part.
   * In such cases, it is assumed that the agent service is running inside
   * a Docker container, so it's safe to return 0.0.0.0 as the
   * hostname, which the agent service is listening on.
   * If the FQDN does not contain a host part, return the host part instead.
   */

  let _url = new URL(url);
  if (_url.host.indexOf('.') !== -1) {
    return '0.0.0.0';
  }

  return _url.host;
}

export async function resolveHostname(hostname: string): Promise<string> {
  const h = hostname.toLowerCase();
  return new Promise((resolve, reject) => {
    // Check /etc/hosts file first
    const hostsFile = readFileSync('/etc/hosts', 'utf-8');
    const hostsEntries = hostsFile
      .split('\n')
      .filter(line => line.trim() !== '' && !line.startsWith('#'))
      .map(line => line.toLowerCase().split(/\s+/));

    for (const entry of hostsEntries) {
      if (entry.includes(h)) {
        return resolve(entry[0]);
      }
    }

    // Fall back to DNS resolution
    resolveDns(h, (err, addresses) => {
      if (err) {
        reject(err);
      } else {
        resolve(addresses[0]);
      }
    });
  });
}
