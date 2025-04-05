import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager, Thread } from './interfaces';
import { Message, MessageRole } from '../llm/interface';
import { logger } from '../utils/logger';

export class FileSessionManager implements SessionManager {
  private sessionsDir: string;

  constructor(baseDir: string = '.terminal-ai-sessions') {
    // Create base directory in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.sessionsDir = path.join(homeDir, baseDir);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
      logger.info(`Created sessions directory at ${this.sessionsDir}`);
    }
  }

  /**
   * Creates a new thread
   */
  async createThread(name?: string): Promise<Thread> {
    const threadId = uuidv4();
    const now = new Date();
    
    const thread: Thread = {
      id: threadId,
      name: name || `Thread-${now.toISOString().slice(0, 19).replace(/[T:-]/g, '')}`,
      createdAt: now,
      updatedAt: now,
      messages: []
    };

    // Save the thread
    await this.saveThread(thread);
    
    return thread;
  }
  
  /**
   * Lists all available threads
   */
  async listThreads(): Promise<Thread[]> {
    try {
      // Get all .json files in the sessions directory
      const files = fs.readdirSync(this.sessionsDir)
        .filter(file => file.endsWith('.json'));
      
      // Read each file and parse the thread
      const threads: Thread[] = [];
      for (const file of files) {
        try {
          const threadData = fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8');
          const thread = JSON.parse(threadData) as Thread;
          
          // Convert string dates back to Date objects
          thread.createdAt = new Date(thread.createdAt);
          thread.updatedAt = new Date(thread.updatedAt);
          
          threads.push(thread);
        } catch (error) {
          logger.error(`Error reading thread file ${file}: ${error}`);
        }
      }
      
      // Sort by updated date, newest first
      return threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
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
      const filePath = path.join(this.sessionsDir, `${threadId}.json`);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const threadData = fs.readFileSync(filePath, 'utf-8');
      const thread = JSON.parse(threadData) as Thread;
      
      // Convert string dates back to Date objects
      thread.createdAt = new Date(thread.createdAt);
      thread.updatedAt = new Date(thread.updatedAt);
      
      return thread;
    } catch (error) {
      logger.error(`Error getting thread ${threadId}: ${error}`);
      return null;
    }
  }
  
  /**
   * Updates a thread with new messages
   */
  async updateThread(threadId: string, messages: Message<MessageRole>[]): Promise<Thread> {
    // Get the existing thread
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread with ID ${threadId} not found`);
    }
    
    // Update the thread
    thread.messages = messages;
    thread.updatedAt = new Date();
    
    // Save the updated thread
    await this.saveThread(thread);
    
    return thread;
  }
  
  /**
   * Renames a thread
   */
  async renameThread(threadId: string, newName: string): Promise<Thread> {
    // Get the existing thread
    const thread = await this.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread with ID ${threadId} not found`);
    }
    
    // Update the thread name
    thread.name = newName;
    thread.updatedAt = new Date();
    
    // Save the updated thread
    await this.saveThread(thread);
    
    return thread;
  }
  
  /**
   * Deletes a thread
   */
  async deleteThread(threadId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.sessionsDir, `${threadId}.json`);
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      logger.error(`Error deleting thread ${threadId}: ${error}`);
      return false;
    }
  }
  
  /**
   * Helper method to save a thread to disk
   */
  private async saveThread(thread: Thread): Promise<void> {
    try {
      const filePath = path.join(this.sessionsDir, `${thread.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(thread, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`Error saving thread ${thread.id}: ${error}`);
      throw error;
    }
  }
} 