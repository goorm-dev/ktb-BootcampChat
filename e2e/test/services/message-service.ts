// test/services/message-service.ts
import OpenAI from 'openai';
import { MESSAGE_PROMPTS } from '../data/message-prompts';
import * as dotenv from 'dotenv';
dotenv.config();

export class MessageService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateMessage(
    promptKeyOrMessage: string,
    parameters?: Record<string, string>
  ): Promise<string> {
    try {
      let finalPrompt: string;

      // promptKey가 MESSAGE_PROMPTS에 있는지 확인
      if (MESSAGE_PROMPTS[promptKeyOrMessage]) {
        // 기존 프롬프트 템플릿 사용
        const promptTemplate = MESSAGE_PROMPTS[promptKeyOrMessage];
        finalPrompt = promptTemplate.prompt;
        
        // 파라미터 치환
        if (parameters) {
          for (const [key, value] of Object.entries(parameters)) {
            finalPrompt = finalPrompt.replace(`[${key}]`, value);
          }
        }
      } else {
        // 직접 메시지 사용
        finalPrompt = promptKeyOrMessage;
        
        // 파라미터가 있다면 치환
        if (parameters) {
          for (const [key, value] of Object.entries(parameters)) {
            finalPrompt = finalPrompt.replace(`[${key}]`, value);
          }
        }
      }

      // OpenAI API 호출
      try {
        const completion = await this.openai.chat.completions.create({
          model: process.env.MESSAGE_MODEL || 'gpt-4-turbo-preview',
          messages: [
            { 
              role: 'system', 
              content: '당신은 채팅 테스트를 위한 메시지를 생성하는 도우미입니다. 자연스럽고 실제 사용자가 작성할 법한 메시지를 생성해주세요. 항상 한국어로 만들어주세요. ", \'는 사용하지 말아주세요.' 
            },
            { role: 'user', content: finalPrompt }
          ],
          temperature: 0.7
        });

        return completion.choices[0]?.message?.content?.trim() || finalPrompt;
      } catch (error) {
        console.warn('OpenAI API 호출 실패, 원본 메시지 반환:', error);
        return finalPrompt;
      }
    } catch (error) {
      console.error('Message generation error:', error);
      // 에러 발생 시 원본 메시지 반환
      return promptKeyOrMessage;
    }
  }

  // 직접 메시지를 보내는 경우를 위한 별도 메소드
  async sendDirectMessage(message: string): Promise<string> {
    return message;
  }
}