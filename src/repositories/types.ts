import { Message, MessageRole } from "../llm/interface";

export type Thread = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message<MessageRole>[];
}

export interface ThreadRepository {
  /**
   * Creates a new thread
   */
  createThread(name?: string): Promise<Thread>;

  /**
   * Lists all available threads
   */
  listThreads(): Promise<Thread[]>;

  /**
   * Gets a thread by ID
   */
  getThread(threadId: string): Promise<Thread | null>;

  /**
   * Updates a thread with new messages
   */
  updateThread(
    threadId: string,
    messages: Message<MessageRole>[],
  ): Promise<Thread>;

  /**
   * Renames a thread
   */
  renameThread(threadId: string, newName: string): Promise<Thread>;

  /**
   * Deletes a thread
   */
  deleteThread(threadId: string): Promise<boolean>;
}
