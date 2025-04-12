import * as fs from 'fs';
import * as path from 'path';

import chromePath from "chrome-path";
import * as playwright from "playwright";
import { z } from "zod";

import { createLLMProvider } from "../../../llm";
import { LLMProvider, Message, MessageRole } from "../../../llm/interface";
import { ToolGroup } from "../../tool-group";
import { LLMTool } from "../../types";

import { PlaywrightController } from "./playwright-controller";
import { ScreenshotUtils } from "./screenshot-utils";



// Common reasoning prompt
const REASONING_TOOL_PROMPT =
  "A short description of the action to be performed and reason for doing so, do not mention the user.";

// Common reasoning schema used in all browser tools
const CommonBrowserActionsSchema = z.object({
  reasoning: z.string().describe(REASONING_TOOL_PROMPT),
});

// Type for the Page object from Playwright
// Using 'any' as we can't properly type it without the actual Playwright typings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageType = any;

/**
 * Implementation of the browser controller
 */
let browserInstance: PlaywrightController | null = null;
let currentPage: PageType = null;

/**
 * Initialize the browser instance if it doesn't exist
 */
const ensureBrowser = async (): Promise<{ browser: PlaywrightController, page: PageType }> => {
  if (!browserInstance) {

    browserInstance = new PlaywrightController(
      './downloads', // downloads folder
      true, // animate actions
      1280,  // viewport width
      800    // viewport height
    );

    // This is a placeholder - in real implementation, we would 
    // launch a browser and create a page

    const browser = await playwright.chromium.launch({ headless: false, executablePath: chromePath.chrome });
    currentPage = await browser.newPage();
    await browserInstance.onNewPage(currentPage);
  }
  return { browser: browserInstance, page: currentPage };
};

/**
 * Take a screenshot and convert to base64
 */
const captureScreenshot = async (page: PageType): Promise<Buffer> => {
  try {
    const screenshot = await page.screenshot();
    return screenshot;
  } catch {
    console.error("Failed to capture screenshot");
    return Buffer.from("");
  }
};

/**
 * Visit URL Tool
 */
const VisitUrlSchema = CommonBrowserActionsSchema.extend({
  url: z.string().describe("The URL to visit in the browser."),
  reasoning: z.string().describe("The reason for visiting the URL."),
  next_action: z.string().describe("The next action to perform after visiting the URL."),
});

export const visitUrlTool: LLMTool<typeof VisitUrlSchema> = {
  name: "visit_url",
  description: "Visit a webpage by URL in the browser.",
  args: VisitUrlSchema,
  prompt: `
    Use the \`visit_url\` function to navigate to a specific URL in the browser.
  `,
  handler: async ({ url, reasoning: _reasoning, next_action: _next_action }) => {
    try {
      const { browser, page } = await ensureBrowser();
      const [reset, _downloadReset] = await browser.visitPage(page, url);

      const html = await page.content();
      // Take a screenshot after navigation
      const _screenshot = await captureScreenshot(page);
      const interactiveElements = await browser.getInteractiveRects(page);
      const viewport = await browser.getVisualViewport(page);
      const { screenshot, visibleRects, rectsAbove, rectsBelow } = await ScreenshotUtils.addMarkersToScreenshot(_screenshot, interactiveElements);

      const screenshot_base64 = screenshot.toString('base64');
      
      // Save screenshot to disk for viewing
      const screenshotDir = path.join(__dirname, 'screenshots');
      
      // Create screenshots directory if it doesn't exist
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
      }
      
      // Save screenshot with timestamp to avoid overwriting
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotPath = path.join(screenshotDir, `screenshot-${timestamp}.png`);
      fs.writeFileSync(screenshotPath, screenshot);
      console.log(`Screenshot saved to: ${screenshotPath}`);

      // Return the data as a JSON string to satisfy the string return type
      return {
        data: JSON.stringify({
          message: `Successfully navigated to ${url}`,
          screenshot_base64,
          visibleRects,
          rectsAbove,
          rectsBelow,
          viewport,
          html,
          reset_metadata: reset
        }),
        error: ""
      };
    } catch (error) {
      console.error(error);
      return {
        data: "",
        error: `Failed to navigate to ${url}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ url, reasoning, next_action }) => {
    console.log(`Visiting URL: ${url}\nReasoning: ${reasoning}\nNext Action: ${next_action}`);
  },
};

/**
 * History Back Tool
 */
export const historyBackTool: LLMTool<typeof CommonBrowserActionsSchema> = {
  name: "history_back",
  description: "Navigates back one page in the browser's history. This is equivalent to clicking the browser back button.",
  args: CommonBrowserActionsSchema,
  prompt: `
    Use the \`history_back\` function to go back to the previous page in the browser.
  `,
  handler: async ({ reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.back(page);

      // Take a screenshot after going back
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: "Successfully navigated back in history",
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to navigate back: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ reasoning }) => {
    console.log(`Going back in browser history - Reasoning: ${reasoning}`);
  },
};

/**
 * Scroll Up Tool
 */
export const scrollUpTool: LLMTool<typeof CommonBrowserActionsSchema> = {
  name: "scroll_up",
  description: "Scrolls the entire browser viewport one page UP towards the beginning.",
  args: CommonBrowserActionsSchema,
  prompt: `
    Use the \`scroll_up\` function to scroll the page up.
  `,
  handler: async ({ reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.pageUp(page);

      // Take a screenshot after scrolling
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: "Successfully scrolled up",
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to scroll up: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ reasoning }) => {
    console.log(`Scrolling page up - Reasoning: ${reasoning}`);
  },
};

/**
 * Scroll Down Tool
 */
export const scrollDownTool: LLMTool<typeof CommonBrowserActionsSchema> = {
  name: "scroll_down",
  description: "Scrolls the entire browser viewport one page DOWN towards the end.",
  args: CommonBrowserActionsSchema,
  prompt: `
    Use the \`scroll_down\` function to scroll the page down.
  `,
  handler: async ({ reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.pageDown(page);

      // Take a screenshot after scrolling
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: "Successfully scrolled down",
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to scroll down: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ reasoning }) => {
    console.log(`Scrolling page down - Reasoning: ${reasoning}`);
  },
};

/**
 * Click Tool
 */
const ClickSchema = CommonBrowserActionsSchema.extend({
  target_id: z.number().int().describe("The numeric id of the target to click."),
});

export const clickTool: LLMTool<typeof ClickSchema> = {
  name: "click",
  description: "Clicks the mouse on the target with the given id.",
  args: ClickSchema,
  prompt: `
    Use the \`click\` function to click on an element in the browser by its ID.
  `,
  handler: async ({ target_id, reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      const newPage = await browser.clickId(page, String(target_id));

      // If click opened a new page, use that for screenshot
      const pageToScreenshot = newPage || page;

      // Take a screenshot after clicking
      const screenshot = await captureScreenshot(pageToScreenshot);

      return {
        data: JSON.stringify({
          message: `Successfully clicked element with id ${target_id}`,
          screenshot,
          new_page: !!newPage
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to click element ${target_id}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ target_id, reasoning }) => {
    console.log(`Clicking element ${target_id} - Reasoning: ${reasoning}`);
  },
};

/**
 * Input Text Tool
 */
const InputTextSchema = CommonBrowserActionsSchema.extend({
  input_field_id: z.number().int().describe("The numeric id of the input field to receive the text."),
  text_value: z.string().describe("The text to type into the input field."),
});

export const inputTextTool: LLMTool<typeof InputTextSchema> = {
  name: "input_text",
  description: "Types the given text value into the specified field.",
  args: InputTextSchema,
  prompt: `
    Use the \`input_text\` function to type text into an input field in the browser.
  `,
  handler: async ({ input_field_id, text_value, reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.fillId(page, String(input_field_id), text_value);

      // Take a screenshot after entering text
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: `Successfully entered text "${text_value}" in field ${input_field_id}`,
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to enter text in field ${input_field_id}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ input_field_id, text_value, reasoning }) => {
    console.log(`Entering text "${text_value}" in field ${input_field_id} - Reasoning: ${reasoning}`);
  },
};

/**
 * Scroll Element Down Tool
 */
const ScrollElementSchema = CommonBrowserActionsSchema.extend({
  target_id: z.number().int().describe("The numeric id of the target to scroll."),
});

export const scrollElementDownTool: LLMTool<typeof ScrollElementSchema> = {
  name: "scroll_element_down",
  description: "Scrolls a given html element (e.g., a div or a menu) DOWN.",
  args: ScrollElementSchema,
  prompt: `
    Use the \`scroll_element_down\` function to scroll a specific element down.
  `,
  handler: async ({ target_id, reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.scrollId(page, String(target_id), "down");

      // Take a screenshot after scrolling
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: `Successfully scrolled element ${target_id} down`,
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to scroll element ${target_id} down: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ target_id, reasoning }) => {
    console.log(`Scrolling element ${target_id} down - Reasoning: ${reasoning}`);
  },
};

/**
 * Scroll Element Up Tool
 */
export const scrollElementUpTool: LLMTool<typeof ScrollElementSchema> = {
  name: "scroll_element_up",
  description: "Scrolls a given html element (e.g., a div or a menu) UP.",
  args: ScrollElementSchema,
  prompt: `
    Use the \`scroll_element_up\` function to scroll a specific element up.
  `,
  handler: async ({ target_id, reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.scrollId(page, String(target_id), "up");

      // Take a screenshot after scrolling
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: `Successfully scrolled element ${target_id} up`,
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to scroll element ${target_id} up: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ target_id, reasoning }) => {
    console.log(`Scrolling element ${target_id} up - Reasoning: ${reasoning}`);
  },
};

/**
 * Hover Tool
 */
export const hoverTool: LLMTool<typeof ScrollElementSchema> = {
  name: "hover",
  description: "Hovers the mouse over the target with the given id.",
  args: ScrollElementSchema,
  prompt: `
    Use the \`hover\` function to hover over an element in the browser.
  `,
  handler: async ({ target_id, reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();
      await browser.hoverId(page, String(target_id));

      // Take a screenshot after hovering
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: `Successfully hovered over element ${target_id}`,
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to hover over element ${target_id}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ target_id, reasoning }) => {
    console.log(`Hovering over element ${target_id} - Reasoning: ${reasoning}`);
  },
};

/**
 * Answer Question Tool
 */
const AnswerQuestionSchema = CommonBrowserActionsSchema.extend({
  question: z.string().describe("The question to answer."),
});

export const answerQuestionTool: LLMTool<typeof AnswerQuestionSchema> = {
  name: "answer_question",
  description: "Uses AI to answer a question about the current webpage's content.",
  args: AnswerQuestionSchema,
  prompt: `
    Use the \`answer_question\` function to ask a question about the current webpage.
  `,
  handler: async ({ question, reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();

      // Get the text content of the webpage
      const content = await browser.getWebpageText(page, 200);

      // Take a screenshot of the page
      const screenshot = await captureScreenshot(page);

      // Create an LLM provider instance
      const llmProvider: LLMProvider = createLLMProvider();

      // Define system prompt for answering questions about webpage content
      const systemPrompt = `You are an AI assistant that answers questions about webpage content.
      Analyze the provided webpage content and answer the question accurately.
      Base your answer solely on the information available in the content.
      If the content doesn't contain relevant information to answer the question, say so.`;

      // Create messages for the LLM call
      const messages: Message<MessageRole>[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Webpage content: ${content}\n\nQuestion: ${question}` }
      ];

      // Make the LLM call and collect the answer
      let answer = "";
      await llmProvider.generateStreamingCompletion(messages, (token: string) => {
        answer += token;
      });

      return {
        data: JSON.stringify({
          question,
          answer,
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to answer question: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ question, reasoning }) => {
    console.log(`Answering question: "${question}" - Reasoning: ${reasoning}`);
  },
};

/**
 * Summarize Page Tool
 */
export const summarizePageTool: LLMTool<typeof CommonBrowserActionsSchema> = {
  name: "summarize_page",
  description: "Uses AI to summarize the entire page.",
  args: CommonBrowserActionsSchema,
  prompt: `
    Use the \`summarize_page\` function to get a summary of the current webpage.
  `,
  handler: async ({ reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();

      // Get page text content
      const content = await browser.getWebpageText(page, 200);

      // Take a screenshot
      const screenshot = await captureScreenshot(page);

      // Get information about interactive elements
      const interactiveElements = await browser.getInteractiveRects(page);

      // Create an LLM provider instance
      const llmProvider: LLMProvider = createLLMProvider();

      // Define system prompt for summarizing webpage content
      const systemPrompt = `You are an AI assistant that summarizes webpage content.
      Provide a concise but informative summary of the webpage based on the provided content.
      Include key topics, main points, and important information.
      Be objective and focus on factual information presented on the page.`;

      // Create messages for the LLM call
      const messages: Message<MessageRole>[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Webpage content: ${content}\n\nThe page contains ${Object.keys(interactiveElements).length} interactive elements. Please provide a concise summary of this webpage.` }
      ];

      // Make the LLM call and collect the summary
      let summary = "";
      await llmProvider.generateStreamingCompletion(messages, (token: string) => {
        summary += token;
      });

      return {
        data: JSON.stringify({
          summary,
          screenshot,
          element_count: Object.keys(interactiveElements).length
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to summarize page: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ reasoning }) => {
    console.log(`Summarizing page - Reasoning: ${reasoning}`);
  },
};

/**
 * Sleep Tool
 */
export const sleepTool: LLMTool<typeof CommonBrowserActionsSchema> = {
  name: "sleep",
  description: "Wait a short period of time. Call this function if the page has not yet fully loaded, or if it is determined that a small delay would increase the task's chances of success.",
  args: CommonBrowserActionsSchema,
  prompt: `
    Use the \`sleep\` function to wait a short period of time while browsing.
  `,
  handler: async ({ reasoning: _ }) => {
    try {
      const { browser, page } = await ensureBrowser();

      // Sleep for 1 second
      await browser.sleep(page, 1);

      // Take a screenshot after sleeping
      const screenshot = await captureScreenshot(page);

      return {
        data: JSON.stringify({
          message: "Successfully waited for a short period",
          screenshot
        }),
        error: ""
      };
    } catch (error) {
      return {
        data: "",
        error: `Failed to sleep: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  render: ({ reasoning }) => {
    console.log(`Waiting for a short period - Reasoning: ${reasoning}`);
  },
};

const browserToolGroup = new ToolGroup();
browserToolGroup.registerTool(visitUrlTool);
browserToolGroup.registerTool(historyBackTool);
browserToolGroup.registerTool(scrollUpTool);
browserToolGroup.registerTool(scrollDownTool);
browserToolGroup.registerTool(clickTool);
browserToolGroup.registerTool(inputTextTool);
browserToolGroup.registerTool(scrollElementDownTool);
browserToolGroup.registerTool(scrollElementUpTool);
browserToolGroup.registerTool(hoverTool);
browserToolGroup.registerTool(answerQuestionTool);
browserToolGroup.registerTool(summarizePageTool);
browserToolGroup.registerTool(sleepTool);

export { browserToolGroup };