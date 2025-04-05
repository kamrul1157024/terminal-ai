import { SQLiteSessionManager } from "./session-manager";
import { logger } from "./utils/logger";
import { runAgentMode } from "./commands/agent";
import { runWithContext, setAutopilot, setCostTracker, setShowCostInfo } from "./utils/context-vars";
import { CumulativeCostTracker } from "./utils/pricing-calculator";
import * as ui from './ui';

/**
 * Lists all threads in the system
 */
export async function listThreads(options: { filter?: string }) {
  try {
    const sessionManager = new SQLiteSessionManager();
    const threads = await sessionManager.listThreads();
    
    if (threads.length === 0) {
      logger.info("No threads found.");
      return;
    }
    
    // Sanitize thread names by removing newlines
    const sanitizedThreads = threads.map(thread => ({
      ...thread,
      name: thread.name.replace(/[\r\n]+/g, ' ').trim()
    }));
    
    // Filter threads if filter option is provided
    const filterValue = options.filter || "";
    const filteredThreads = filterValue
      ? sanitizedThreads.filter(thread => thread.name.toLowerCase().includes(filterValue.toLowerCase()))
      : sanitizedThreads;
    
    if (filteredThreads.length === 0 && filterValue) {
      logger.info(`No threads matching filter "${filterValue}" found.`);
      return;
    }
    
    await handleThreadSelection(threads, filteredThreads);
  } catch (error) {
    // Check if this is an exit prompt error (from Ctrl+C)
    if (error instanceof Error && (error.name === 'ExitPromptError' || error.message?.includes('User force closed the prompt'))) {
      logger.info('\nOperation cancelled by user (Ctrl+C)');
      return;
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Handles thread selection process
 */
async function handleThreadSelection(allThreads: any[], displayedThreads: any[]) {
  try {
    const selectedThreadId = await ui.promptThreadSelection(displayedThreads);
    await attachToThread(selectedThreadId);
  } catch (error) {
    // Check if this is an exit prompt error (from Ctrl+C)
    if (error instanceof Error && (error.name === 'ExitPromptError' || error.message?.includes('User force closed the prompt'))) {
      logger.info('\nOperation cancelled by user (Ctrl+C)');
      return;
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Deletes a thread by ID
 */
export async function deleteThread(threadId: string) {
  const sessionManager = new SQLiteSessionManager();
  const thread = await sessionManager.getThread(threadId);
  
  if (!thread) {
    logger.error(`Thread with ID ${threadId} not found.`);
    return;
  }
  
  const result = await sessionManager.deleteThread(threadId);
  if (result) {
    logger.info(`Thread "${thread.name}" (ID: ${threadId}) deleted successfully.`);
  } else {
    logger.error(`Failed to delete thread with ID ${threadId}.`);
  }
}

/**
 * Attaches to an existing thread
 */
export async function attachToThread(threadId: string) {
  const sessionManager = new SQLiteSessionManager();
  const thread = await sessionManager.getThread(threadId);
  
  if (!thread) {
    logger.error(`Thread with ID ${threadId} not found.`);
    return;
  }
  
  logger.info(`Attaching to thread: ${thread.name} (ID: ${thread.id})`);
  
  ui.displayConversationHistory(thread);
  await startAgentModeWithThread(thread.id);
}

/**
 * Starts agent mode with a specific thread
 */
async function startAgentModeWithThread(threadId: string) {
  await runWithContext(async () => {
    setAutopilot(false);
    setCostTracker(new CumulativeCostTracker());
    setShowCostInfo(false);
    
    await runAgentMode({
      input: "",
      threadId,
    });
  });
}

/**
 * Renames a thread
 */
export async function renameThread(threadId: string, newName: string) {
  const sessionManager = new SQLiteSessionManager();
  const thread = await sessionManager.getThread(threadId);
  
  if (!thread) {
    logger.error(`Thread with ID ${threadId} not found.`);
    return;
  }
  
  try {
    const oldName = thread.name;
    const updatedThread = await sessionManager.renameThread(threadId, newName);
    logger.info(`Thread renamed from "${oldName}" to "${updatedThread.name}" (ID: ${threadId}).`);
  } catch (error) {
    logger.error(`Failed to rename thread: ${error}`);
  }
} 