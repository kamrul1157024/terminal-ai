import { spawn } from 'child_process';

import { logger } from '../logger';

export async function getGitInfo(): Promise<string> {
  try {
    // Check if we're in a git repository
    const { stdout: isGitRepo } = await spawnCommand('git', ['rev-parse', '--is-inside-work-tree'], process.env.SHELL || '/bin/bash');
    if (isGitRepo.trim() !== 'true') {
      return '';
    }

    // Get git status
    const { stdout: status } = await spawnCommand('git', ['status', '--porcelain'], process.env.SHELL || '/bin/bash');
    
    // Get git diff
    const { stdout: diff } = await spawnCommand('git', ['diff'], process.env.SHELL || '/bin/bash');

    let gitInfo = '';
    if (status) {
      gitInfo += 'Git Status:\n' + status + '\n\n';
    }
    if (diff) {
      gitInfo += 'Git Diff:\n' + diff + '\n';
    }

    return gitInfo;
  } catch {
    logger.debug('Failed to get git information');
    return '';
  }
}

async function spawnCommand(command: string, args: string[], shell: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error: Error) => {
      reject(error);
    });
  });
} 