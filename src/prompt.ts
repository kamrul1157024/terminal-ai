import { logger } from "./logger";
import { getUserAliases, getAvailableCommands } from "./utils/aliases";
import { getSystemInfoFromOS } from "./utils/system-info";

const getSystemPrompt = async (context: string) => {
  const BasePrompt = `
  You are a helpful terminal assistant. Convert natural language requests into terminal commands. 
  Use the provided context to inform your command generation. 

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
