import path from "path";

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

import { Message, MessageRole } from "../llm/interface";
import { logger } from "../logger";

import { ThreadRepository, Thread } from "./types";

// Define interfaces for database row types
type ThreadRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

type MessageRow = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
}

/**
 * Utility class to handle serialization and deserialization of messages
 */
class MessageSerializer {
  /**
   * Serialize a message for storage in SQLite
   */
  static serialize(message: Message<MessageRole>): string {
    if (typeof message.content === "string") {
      return message.content;
    }
    return JSON.stringify(message.content);
  }

  /**
   * Deserialize a message from SQLite storage
   */
  static deserialize(role: string, content: string): Message<MessageRole> {
    // Simple text messages
    if (role === "user" || role === "system" || role === "assistant") {
      return {
        role: role as MessageRole,
        content: content,
      } as Message<MessageRole>;
    }

    // For function or function_call messages, try to parse JSON content
    try {
      const parsedContent = JSON.parse(content);
      return {
        role: role as MessageRole,
        content: parsedContent,
      } as Message<MessageRole>;
    } catch {
      // Fallback to string content if JSON parsing fails
      return {
        role: role as MessageRole,
        content: content,
      } as unknown as Message<MessageRole>;
    }
  }
}

export class SQLiteThreadRepository implements ThreadRepository {
  private db: Database.Database;

  constructor(baseDir: string = ".terminal-ai-sessions") {
    // Create base directory in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const dbPath = path.join(homeDir, baseDir, "terminal-ai.db");

    try {
      this.db = new Database(dbPath);
      this.initDatabase();
      logger.info(`Connected to database at ${dbPath}`);
    } catch (error) {
      logger.error(`Failed to connect to database: ${error}`);
      throw error;
    }
  }

  /**
   * Initialize the database by creating necessary tables if they don't exist
   */
  private initDatabase(): void {
    // Create threads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      )
    `);

    logger.info("Database initialized successfully");
  }

  /**
   * Creates a new thread
   */
  async createThread(name?: string): Promise<Thread> {
    const threadId = uuidv4();
    const now = new Date();
    const isoDate = now.toISOString();

    const threadName =
      name || `Thread-${now.toISOString().slice(0, 19).replace(/[T:-]/g, "")}`;

    const stmt = this.db.prepare(`
      INSERT INTO threads (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(threadId, threadName, isoDate, isoDate);

    const thread: Thread = {
      id: threadId,
      name: threadName,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    return thread;
  }

  /**
   * Lists all available threads (limited to last 30)
   */
  async listThreads(): Promise<Thread[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, created_at, updated_at
        FROM threads
        ORDER BY updated_at DESC
        LIMIT 30
      `);

      const rows = stmt.all() as ThreadRow[];

      const threads: Thread[] = [];
      for (const row of rows) {
        const thread = await this.getThread(row.id);
        if (thread) {
          threads.push(thread);
        }
      }

      return threads;
    } catch (error) {
      logger.error(`Error listing threads: ${error}`);
      return [];
    }
  }

  /**
   * Gets a thread by ID
   */
  async getThread(threadId: string): Promise<Thread | null> {
    try {
      // Get thread
      const threadStmt = this.db.prepare(`
        SELECT id, name, created_at, updated_at
        FROM threads
        WHERE id = ?
      `);

      const thread = threadStmt.get(threadId) as ThreadRow | undefined;
      if (!thread) {
        return null;
      }

      // Get messages for the thread
      const messagesStmt = this.db.prepare(`
        SELECT id, role, content, created_at
        FROM messages
        WHERE thread_id = ?
        ORDER BY created_at ASC
      `);

      const messagesRows = messagesStmt.all(threadId) as MessageRow[];

      // Convert raw messages to typed messages using the serializer
      const messages: Message<MessageRole>[] = [];
      for (const row of messagesRows) {
        try {
          const message = MessageSerializer.deserialize(row.role, row.content);
          messages.push(message);
        } catch (error) {
          logger.error(`Error deserializing message ${row.id}: ${error}`);
        }
      }

      // Convert to Thread object
      return {
        id: thread.id,
        name: thread.name,
        createdAt: new Date(thread.created_at),
        updatedAt: new Date(thread.updated_at),
        messages,
      };
    } catch (error) {
      logger.error(`Error getting thread ${threadId}: ${error}`);
      return null;
    }
  }

  /**
   * Updates a thread with new messages
   */
  async updateThread(
    threadId: string,
    messages: Message<MessageRole>[],
  ): Promise<Thread> {
    try {
      // Start a transaction
      const transaction = this.db.transaction(() => {
        // Update the thread's updated_at timestamp
        const updateThreadStmt = this.db.prepare(`
          UPDATE threads
          SET updated_at = ?
          WHERE id = ?
        `);

        const now = new Date().toISOString();
        updateThreadStmt.run(now, threadId);

        // Delete existing messages
        const deleteMessagesStmt = this.db.prepare(`
          DELETE FROM messages
          WHERE thread_id = ?
        `);

        deleteMessagesStmt.run(threadId);

        // Insert new messages
        const insertMessageStmt = this.db.prepare(`
          INSERT INTO messages (id, thread_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const message of messages) {
          // Serialize message content
          const contentStr = MessageSerializer.serialize(message);

          insertMessageStmt.run(
            uuidv4(), // Generate a new ID for each message
            threadId,
            message.role,
            contentStr,
            now,
          );
        }
      });

      // Execute the transaction
      transaction();

      // Get the updated thread
      const thread = await this.getThread(threadId);
      if (!thread) {
        throw new Error(`Thread with ID ${threadId} not found`);
      }

      return thread;
    } catch (error) {
      logger.error(`Error updating thread ${threadId}: ${error}`);
      throw error;
    }
  }

  /**
   * Renames a thread
   */
  async renameThread(threadId: string, newName: string): Promise<Thread> {
    try {
      const stmt = this.db.prepare(`
        UPDATE threads
        SET name = ?, updated_at = ?
        WHERE id = ?
      `);

      const now = new Date().toISOString();
      const result = stmt.run(newName, now, threadId);

      if (result.changes === 0) {
        throw new Error(`Thread with ID ${threadId} not found`);
      }

      // Get the updated thread
      const thread = await this.getThread(threadId);
      if (!thread) {
        throw new Error(`Thread with ID ${threadId} not found`);
      }

      return thread;
    } catch (error) {
      logger.error(`Error renaming thread ${threadId}: ${error}`);
      throw error;
    }
  }

  /**
   * Deletes a thread
   */
  async deleteThread(threadId: string): Promise<boolean> {
    try {
      // Start a transaction
      const transaction = this.db.transaction(() => {
        // Delete messages first
        const deleteMessagesStmt = this.db.prepare(`
          DELETE FROM messages
          WHERE thread_id = ?
        `);

        deleteMessagesStmt.run(threadId);

        // Delete the thread
        const deleteThreadStmt = this.db.prepare(`
          DELETE FROM threads
          WHERE id = ?
        `);

        deleteThreadStmt.run(threadId);
      });

      // Execute the transaction
      transaction();

      return true;
    } catch (error) {
      logger.error(`Error deleting thread ${threadId}: ${error}`);
      return false;
    }
  }

  /**
   * Close the database connection when done
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
