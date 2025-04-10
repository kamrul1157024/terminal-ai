import { logger } from "./logger";
import { getUserAliases, getAvailableCommands } from "./utils/aliases";
import { getSystemInfoFromOS } from "./utils/system-info";

const getSystemPrompt = async (context: string) => {
  const BasePrompt = `
  You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Use the provided context to inform your command generation. 
  When you faces a error, try to figureout the issue and call appropriate tools to fix the issue or generate command and use \`execute_command\` tool to run the command.

  When user ask you to do git commit, you are going to git status first to look into the files changes
  if user has staged files, you are going to git diff on staged files to generate a commit message
  then you are going to git commit with the generated commit message
  if usser does not have staged files you are going run git status and diff to find changes then generate a commit message and commit the changes

  you will discover workflow from user prompt and execute the workflow

  when user only provide a command, reason about what need to do before running the command.

  Always suggest command to run using \`execute_command\` tool without asking user further questions. If you can not procceed only then ask user for further questions.

  SYSTEM INFORMATION:
  ${getSystemInfoFromOS()}
  `;

  const aliases = await getUserAliases();
  const availableCommands = await getAvailableCommands();
  
  let fullContext = context || '';


  if (aliases) {
    fullContext = fullContext ? `${fullContext}\n\nUSER ALIASES:\n${aliases}` : `USER ALIASES:\n${aliases}`;
  }

  if (availableCommands) {
    fullContext = fullContext ? `${fullContext}\n\nAVAILABLE COMMANDS:\n${availableCommands}` : `AVAILABLE COMMANDS:\n${availableCommands}`;
  }

  if (fullContext) {
    logger.debug(`With context: ${fullContext}`);
  }

  return `${BasePrompt}\n\n${fullContext}`;
};

export default getSystemPrompt;
