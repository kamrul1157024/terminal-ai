/**
 * Check if a command is potentially system-modifying or dangerous
 * @param command The command to check
 * @returns True if the command might modify the system
 */
export function isSystemModifyingCommand(command: string): boolean {
  const writePatterns = [
    /\brm\b/,
    /\bmv\b/,
    /\bcp\b/,
    /\btouch\b/,
    /\bmkdir\b/,
    /\bsudo\b/,
    /\bapt\b.*\binstall\b/,
    /\bapt\b.*\bremove\b/,
    /\byum\b.*\binstall\b/,
    /\byum\b.*\bremove\b/,
    /\bdnf\b.*\binstall\b/,
    /\bdnf\b.*\bremove\b/,
    /\bbrew\b.*\binstall\b/,
    /\bbrew\b.*\buninstall\b/,
    /\bchmod\b/,
    /\bchown\b/,
    /\bchgrp\b/,
    />/, // Redirect output
    /\|\s*tee\b/, // Pipe to tee
  ];

  return writePatterns.some((pattern) => pattern.test(command));
}
