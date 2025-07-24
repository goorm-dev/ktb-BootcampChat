const OpenAI = require('openai');
const axios = require('axios');
const { TEST_PROMPTS, AI_RESPONSE_TEMPLATES } = require('../data/ai-prompts');

/**
 * @typedef {Object} AIConfig
 * @property {string} apiKey
 * @property {string} model
 * @property {string} [baseURL]
 */

/**
 * @typedef {Object} AIResponse
 * @property {boolean} success
 * @property {string} content
 * @property {string} [error]
 */

class AIService {
  /** @type {any} */
  openai;
  /** @type {any} */
  claudeApi;
  /** @type {AIConfig} */
  config;

  /**
   * @param {AIConfig} config
   */
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  /**
   * @param {string} promptKey
   * @param {Record<string, string>} parameters
   * @param {'wayneAI' | 'consultingAI'} aiType
   * @returns {Promise<AIResponse>}
   */
  async generateResponse(promptKey, parameters, aiType) {
    try {
      const promptTemplate = TEST_PROMPTS[promptKey];
      if (!promptTemplate) {
        throw new Error('Invalid prompt key');
      }

      let prompt = promptTemplate.prompt;
      for (const [key, value] of Object.entries(parameters)) {
        prompt = prompt.replace(`[${key}]`, value);
      }

      if (aiType === 'wayneAI') {
        return await this.callGPT(prompt);
      } else {
        return await this.callClaude(prompt);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('AI response generation error:', err.message);
      return {
        success: false,
        content: AI_RESPONSE_TEMPLATES.ERROR.API_ERROR,
        error: err.message,
      };
    }
  }

  /**
   * @param {string} prompt
   * @returns {Promise<AIResponse>}
   */
  async callGPT(prompt) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: '당신은 WayneAI라는 AI 어시스턴트입니다. 항상 한국어로 답해주세요. ", \'는 사용하지 말아주세요.',
          },
          { role: 'user', content: prompt },
        ],
      });

      return {
        success: true,
        content: completion.choices[0]?.message?.content || AI_RESPONSE_TEMPLATES.FALLBACK.DEFAULT,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('GPT API Error:', err.message);
      return {
        success: false,
        content: AI_RESPONSE_TEMPLATES.ERROR.API_ERROR,
        error: err.message,
      };
    }
  }

  /**
   * @param {string} prompt
   * @returns {Promise<AIResponse>}
   */
  async callClaude(prompt) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
        }
      );

      return {
        success: true,
        content: response.data.content[0].text,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('Claude API Error:', err.message);
      return {
        success: false,
        content: AI_RESPONSE_TEMPLATES.ERROR.API_ERROR,
        error: err.message,
      };
    }
  }
}

module.exports = {
  AIService,
};