import chalk from 'chalk';
import inquirer from 'inquirer';

/**
 * Displays a list of threads
 */
export function displayThreadsList(threads: any[]) {
  console.log(chalk.bold.blue("\n📋 Conversation Threads"));
  console.log(chalk.blue("=====================\n"));
  
  // Format threads for display
  const formattedThreads = formatThreadsForDisplay(threads);
  
  // Display threads
  formattedThreads.forEach(thread => {
    console.log(`${chalk.cyan(thread.index)}. ${thread.displayString}`);
  });
}

/**
 * Formats thread data for display
 */
export function formatThreadsForDisplay(threads: any[]) {
  return threads.map((thread, index) => {
    const messageCount = thread.messages.length;
    const lastUpdate = thread.updatedAt.toLocaleString();
    
    return {
      index: index + 1,
      id: thread.id,
      name: thread.name,
      messageCount,
      lastUpdate,
      displayString: `${chalk.green(thread.name)} ${chalk.gray(`(ID: ${thread.id})`)}\n   ${chalk.yellow(`Messages: ${messageCount}`)} • ${chalk.blue(`Last updated: ${lastUpdate}`)}`
    };
  });
}

/**
 * Displays the conversation history of a thread
 */
export function displayConversationHistory(thread: any) {
  // Print the existing conversation
  if (thread.messages.length > 0) {
    console.log(chalk.bold.blue("\nConversation history:"));
    console.log(chalk.blue("===================="));
    
    // Display conversation history
    thread.messages.forEach((message: any) => {
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      if (message.role === "user") {
        console.log(`\n${chalk.green(`${role}:`)} ${message.content}`);
      } else if (message.role === "assistant") {
        console.log(`\n${chalk.yellow(`${role}:`)} ${message.content}`);
      }
    });
    
    console.log(chalk.blue("\n===================="));
    console.log(chalk.bold("Continuing conversation. Type your message below:"));
  }
}

/**
 * Prompts user to select an action for threads
 */
export async function promptThreadAction(): Promise<string> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Attach to a thread', value: 'attach' },
        { name: 'Return to command line', value: 'exit' }
      ]
    }
  ]);
  
  return action;
}

/**
 * Prompts user to select a thread
 */
export async function promptThreadSelection(threads: any[]): Promise<string> {
  const formattedThreads = formatThreadsForDisplay(threads);
  
  // Add SIGINT (Ctrl+C) handler
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nOperation cancelled by user. Exiting...'));
    process.exit(0);
  });
  
  const { selectedThread } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedThread',
      message: 'Select a thread to attach:',
      choices: formattedThreads.map(thread => ({
        name: `[${thread.id}] ${thread.name}`,
        value: thread.id
      }))
    }
  ]);
  
  return selectedThread;
} 