#!/usr/bin/env node

import { Command } from 'commander';
import { processAiCommand } from './commands/ai';
import { initCommand } from './commands/init';
import { configExists } from './utils/config';

// Create a new command instance
const program = new Command();

program
  .name('ai')
  .description('AI-powered terminal command interpreter')
  .version('1.0.0');

// Add init command
program
  .command('init')
  .description('Initialize and configure Terminal AI')
  .action(async () => {
    await initCommand();
  });

// Add the main command
program
  .argument('<input>', 'The command to interpret')
  .action(async (input: string) => {
    // Check if config exists
    if (!configExists()) {
      console.log('Terminal AI is not configured. Running setup wizard...');
      await initCommand();
    }
    
    await processAiCommand(input);
  });

// Parse arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 