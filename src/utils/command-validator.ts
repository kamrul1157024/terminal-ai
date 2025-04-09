export function isSystemQueryingCommand(command: string): boolean {
  const queryPatterns = [
    /\bcat\b/,
    /\bless\b/,
    /\bhead\b/,
    /\btail\b/,
    /\bgrep\b/,
    /\bfind\b/,
    /\blocate\b/,
    /\bwhich\b/,
    /\bwhereis\b/,
    /\bwhatis\b/,
    /\bman\b/,
    /\binfo\b/,
    /\bapropos\b/,
    /\bhelp\b/,
    /\bls\b/,
    /\bps\b/,
    /\bdf\b/,
    /\bdu\b/,
    /\btop\b/,
    /\bhtop\b/,
    /\bfree\b/,
    /\buname\b/,
    /\bstat\b/,
    /\bfile\b/,
    /\bwhoami\b/,
    /\bid\b/,
    /\benv\b/,
    /\bprintenv\b/,
    /\bpwd\b/,

    // Docker commands
    /\bdocker\s+ps\b/,
    /\bdocker\s+images\b/,
    /\bdocker\s+inspect\b/,

    // Package managers
    /\bnpm\s+list\b/,
    /\byarn\s+list\b/,
    /\bpip\s+list\b/,

    // Network tools
    /\bping\b/,
    /\btraceroute\b/,
    /\bnslookup\b/,
    /\bdig\b/,
    /\bnetstat\b/,
    /\bifconfig\b/,
    /\bip\s+addr\b/,
  ];

  return queryPatterns.some((pattern) => pattern.test(command));
}
