import { z } from "zod";

import { logger } from "../../logger";
import { executeCommand } from "../../utils/command-executor";
import { LLMFunction } from "../types";

const gitStatusArgs = z.object({
  path: z.string().optional().describe("Optional path to check git status"),
});

export const gitStatus: LLMFunction<typeof gitStatusArgs> = {
  name: "git_status",
  description: "Check the status of the git repository",
  args: gitStatusArgs,
  prompt: "git status",
  handler: async ({ path }) => {
    const command = path ? `git status ${path}` : "git status";
    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ path }) => {
    logger.command(`git status ${path || ""}`);
  },
};

// Git Add
const gitAddArgs = z.object({
  files: z.string().describe("Files to add to git staging area"),
});

export const gitAdd: LLMFunction<typeof gitAddArgs> = {
  name: "git_add",
  description: "Add files to git staging area",
  args: gitAddArgs,
  prompt: "Run git_status first to see which files need staging then run git_add to add them",
  handler: async ({ files }) => {
    const command = `git add ${files}`;
    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ files }) => {
    logger.command(`git add ${files}`);
  },
};

// Git Commit
const gitCommitArgs = z.object({
  message: z.string().describe("Commit message"),
});

export const gitCommit: LLMFunction<typeof gitCommitArgs> = {
  name: "git_commit",
  description: "git commit Commit changes to git",
  args: gitCommitArgs,
  prompt: "Run git_status or git diff to find changes then generate a commit message based on the changes and run git_commit to commit the changes",
  handler: async ({ message }) => {
    const command = `git commit -m "${message}"`;
    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ message }) => {
    logger.command(`git commit -m "${message}"`);
  },
};

// Git Push
const gitPushArgs = z.object({
  remote: z.string().optional().describe("Remote repository name"),
  branch: z.string().optional().describe("Branch name to push"),
});

export const gitPush: LLMFunction<typeof gitPushArgs> = {
  name: "git_push",
  description: "Push changes to remote repository",
  args: gitPushArgs,
  prompt: "Ensure all changes are committed first with git_commit",
  handler: async ({ remote, branch }) => {
    const command = `git push ${remote || ""} ${branch || ""}`.trim();
    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ remote, branch }) => {
    logger.command(`git push ${remote || ""} ${branch || ""}`.trim());
  },
};

// Git Pull
const gitPullArgs = z.object({
  remote: z.string().optional().describe("Remote repository name"),
  branch: z.string().optional().describe("Branch name to pull"),
});

export const gitPull: LLMFunction<typeof gitPullArgs> = {
  name: "git_pull",
  description: "Pull changes from remote repository",
  args: gitPullArgs,
  prompt: "Check git_status first to ensure your working directory is clean",
  handler: async ({ remote, branch }) => {
    const command = `git pull ${remote || ""} ${branch || ""}`.trim();
    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ remote, branch }) => {
    logger.command(`git pull ${remote || ""} ${branch || ""}`.trim());
  },
};

// Git Branch
const gitBranchArgs = z.object({
  name: z.string().optional().describe("Branch name to create or switch to"),
  delete: z.boolean().optional().describe("Whether to delete the branch"),
});

export const gitBranch: LLMFunction<typeof gitBranchArgs> = {
  name: "git_branch",
  description: "Create, list, or delete branches",
  args: gitBranchArgs,
  prompt: "List branches first without parameters, then create or delete as needed",
  handler: async ({ name, delete: shouldDelete }) => {
    let command = "git branch";
    if (name) {
      if (shouldDelete) {
        command = `git branch -d ${name}`;
      } else {
        command = `git checkout -b ${name}`;
      }
    }
    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ name, delete: shouldDelete }) => {
    if (name) {
      if (shouldDelete) {
        logger.command(`git branch -d ${name}`);
      } else {
        logger.command(`git checkout -b ${name}`);
      }
    } else {
      logger.command("git branch");
    }
  },
};

// Git Remote
const gitRemoteArgs = z.object({
  action: z.enum(["add", "remove", "rename", "set-url", "get-url", "show"]).describe("Action to perform on remote"),
  name: z.string().optional().describe("Remote name"),
  url: z.string().optional().describe("Remote URL"),
  newName: z.string().optional().describe("New name for rename action"),
});

export const gitRemote: LLMFunction<typeof gitRemoteArgs> = {
  name: "git_remote",
  description: "Manage remote repositories",
  args: gitRemoteArgs,
  prompt: "Use 'show' action first to view existing remotes before modifying",
  handler: async ({ action, name, url, newName }) => {
    let command = "git remote";
    
    switch (action) {
      case "add":
        if (!name || !url) {
          return { data: "", error: "Name and URL are required for adding a remote" };
        }
        command = `git remote add ${name} ${url}`;
        break;
      case "remove":
        if (!name) {
          return { data: "", error: "Name is required for removing a remote" };
        }
        command = `git remote remove ${name}`;
        break;
      case "rename":
        if (!name || !newName) {
          return { data: "", error: "Name and newName are required for renaming a remote" };
        }
        command = `git remote rename ${name} ${newName}`;
        break;
      case "set-url":
        if (!name || !url) {
          return { data: "", error: "Name and URL are required for setting remote URL" };
        }
        command = `git remote set-url ${name} ${url}`;
        break;
      case "get-url":
        if (!name) {
          return { data: "", error: "Name is required for getting remote URL" };
        }
        command = `git remote get-url ${name}`;
        break;
      case "show":
        command = name ? `git remote show ${name}` : "git remote -v";
        break;
    }

    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ action, name, url, newName }) => {
    let command = "git remote";
    
    switch (action) {
      case "add":
        command = `git remote add ${name} ${url}`;
        break;
      case "remove":
        command = `git remote remove ${name}`;
        break;
      case "rename":
        command = `git remote rename ${name} ${newName}`;
        break;
      case "set-url":
        command = `git remote set-url ${name} ${url}`;
        break;
      case "get-url":
        command = `git remote get-url ${name}`;
        break;
      case "show":
        command = name ? `git remote show ${name}` : "git remote -v";
        break;
    }
    
    logger.command(command);
  },
};

// Git Rebase
const gitRebaseArgs = z.object({
  base: z.string().describe("The base commit to rebase from"),
  interactive: z.boolean().optional().describe("Whether to perform an interactive rebase"),
  onto: z.string().optional().describe("The new base to rebase onto"),
  continue: z.boolean().optional().describe("Continue an interrupted rebase"),
  abort: z.boolean().optional().describe("Abort an interrupted rebase"),
  skip: z.boolean().optional().describe("Skip the current commit in an interrupted rebase"),
});

export const gitRebase: LLMFunction<typeof gitRebaseArgs> = {
  name: "git_rebase",
  description: "Perform git rebase operations, including interactive rebase",
  args: gitRebaseArgs,
  prompt: "Ensure all changes are committed first. Use git_status to verify working directory state",
  handler: async ({ base, interactive, onto, continue: continueRebase, abort, skip }) => {
    let command = "git rebase";

    if (abort) {
      command = "git rebase --abort";
    } else if (continueRebase) {
      command = "git rebase --continue";
    } else if (skip) {
      command = "git rebase --skip";
    } else {
      if (interactive) {
        command += " -i";
      }
      if (onto) {
        command += ` --onto ${onto}`;
      }
      command += ` ${base}`;
    }

    const { stdout, stderr } = await executeCommand(command, false);
    return { data: stdout, error: stderr };
  },
  render: ({ base, interactive, onto, continue: continueRebase, abort, skip }) => {
    let command = "git rebase";

    if (abort) {
      command = "git rebase --abort";
    } else if (continueRebase) {
      command = "git rebase --continue";
    } else if (skip) {
      command = "git rebase --skip";
    } else {
      if (interactive) {
        command += " -i";
      }
      if (onto) {
        command += ` --onto ${onto}`;
      }
      command += ` ${base}`;
    }

    logger.command(command);
  },
};