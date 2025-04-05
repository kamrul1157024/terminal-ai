import os from "os";

export function getSystemInfoFromOS(): string {
  const osType = os.type();
  const osRelease = os.release();
  const osPlatform = os.platform();
  const osArch = os.arch();
  const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeMemory = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const cpuInfo = os.cpus()[0]?.model || "Unknown CPU";
  const cpuCores = os.cpus().length;
  const uptime = Math.round(os.uptime() / 3600);
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const homedir = os.homedir();
  const shell = os.userInfo().shell || "Unknown shell";

  return `
OS: ${osType} ${osRelease} (${osPlatform} ${osArch})
Hostname: ${hostname}
Username: ${username}
Home directory: ${homedir}
Shell: ${shell}
CPU: ${cpuInfo} (${cpuCores} cores)
Memory: ${freeMemory}GB free of ${totalMemory}GB total
Uptime: ${uptime} hours
`;
}
