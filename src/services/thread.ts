import { runAgent } from "../commands/agent";
import { logger } from "../logger";
import { SQLiteThreadRepository } from "../repositories";
import { Thread } from "../repositories";
import { CumulativeCostTracker } from "../services/pricing";
import * as Output from "../ui/output";
import {
  runWithContext,
  setAutoApprove,
  setCostTracker,
  setShowCostInfo,
} from "../utils/context-vars";

/**
 * Lists all threads in the system
 */
export async function listThreads(options: { filter?: string }) {
  try {
    const threadRepository = new SQLiteThreadRepository();
    const threads = await threadRepository.listThreads();

    if (threads.length === 0) {
      logger.info("No threads found.");
      return;
    }

    // Sanitize thread names by removing newlines
    const sanitizedThreads = threads.map((thread) => ({
      ...thread,
      name: thread.name.replace(/[\r\n]+/g, " ").trim(),
    }));

    // Filter threads if filter option is provided
    const filterValue = options.filter || "";
    const filteredThreads = filterValue
      ? sanitizedThreads.filter((thread) =>
          thread.name.toLowerCase().includes(filterValue.toLowerCase()),
        )
      : sanitizedThreads;

    if (filteredThreads.length === 0 && filterValue) {
      logger.info(`No threads matching filter "${filterValue}" found.`);
      return;
    }

    await handleThreadSelection(filteredThreads);
  } catch (error) {
    // Check if this is an exit prompt error (from Ctrl+C)
    if (
      error instanceof Error &&
      (error.name === "ExitPromptError" ||
        error.message?.includes("User force closed the prompt"))
    ) {
      logger.info("\nOperation cancelled by user (Ctrl+C)");
      return;
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Handles thread selection process
 */
async function handleThreadSelection(displayedThreads: Thread[]) {
  try {
    const selectedThreadId =
      await Output.promptThreadSelection(displayedThreads);
    await attachToThread(selectedThreadId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "ExitPromptError" ||
        error.message?.includes("User force closed the prompt"))
    ) {
      logger.info("\nOperation cancelled by user (Ctrl+C)");
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
  const threadRepository = new SQLiteThreadRepository();
  const thread = await threadRepository.getThread(threadId);

  if (!thread) {
    logger.error(`Thread with ID ${threadId} not found.`);
    return;
  }

  const result = await threadRepository.deleteThread(threadId);
  if (result) {
    logger.info(
      `Thread "${thread.name}" (ID: ${threadId}) deleted successfully.`,
    );
  } else {
    logger.error(`Failed to delete thread with ID ${threadId}.`);
  }
}

/**
 * Attaches to an existing thread
 */
export async function attachToThread(threadId: string) {
  const threadRepository = new SQLiteThreadRepository();
  const thread = await threadRepository.getThread(threadId);

  if (!thread) {
    logger.error(`Thread with ID ${threadId} not found.`);
    return;
  }
  logger.info(`Attaching to thread: ${thread.name} (ID: ${thread.id})`);
  await startAgentModeWithThread(thread.id);
}

/**
 * Starts agent mode with a specific thread
 */
async function startAgentModeWithThread(threadId: string) {
  await runWithContext(async () => {
    setAutoApprove(false);
    setCostTracker(new CumulativeCostTracker());
    setShowCostInfo(false);

    await runAgent({
      input: "",
      threadId,
    });
  });
}

/**
 * Renames a thread
 */
export async function renameThread(threadId: string, newName: string) {
  const threadRepository = new SQLiteThreadRepository();
  const thread = await threadRepository.getThread(threadId);

  if (!thread) {
    logger.error(`Thread with ID ${threadId} not found.`);
    return;
  }

  try {
    const oldName = thread.name;
    const updatedThread = await threadRepository.renameThread(
      threadId,
      newName,
    );
    logger.info(
      `Thread renamed from "${oldName}" to "${updatedThread.name}" (ID: ${threadId}).`,
    );
  } catch (error) {
    logger.error(`Failed to rename thread: ${error}`);
  }
}
