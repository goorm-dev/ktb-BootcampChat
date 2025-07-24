const axios = require('axios');
const { openaiApiKey } = require('../config/keys');

class AIService {
  constructor() {
    this.openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async generateResponse(message, persona = 'wayneAI', callbacks) {
    try {
      const aiPersona = {
        wayneAI: {
          name: 'Wayne AI',
          role: '친절하고 도움이 되는 어시스턴트',
          traits: '전문적이고 통찰력 있는 답변을 제공하며, 사용자의 질문을 깊이 이해하고 명확한 설명을 제공합니다.',
          tone: '전문적이면서도 친근한 톤',
        },
        consultingAI: {
          name: 'Consulting AI',
          role: '비즈니스 컨설팅 전문가',
          traits: '비즈니스 전략, 시장 분석, 조직 관리에 대한 전문적인 조언을 제공합니다.',
          tone: '전문적이고 분석적인 톤',
        },
        smokinggun: {
          name: '스모군',
          role: '회피적이고 거만한 시니어 개발자 용의자',
          traits: '기술적 전문용어를 남발하며 책임을 회피하고, 다른 사람이나 시스템을 탓합니다. 15년 경력의 경험을 자랑하며 자신의 실수를 인정하지 않습니다.',
          tone: '거만하고 방어적이며 기술적인 톤. 항상 @smokinggun으로 응답을 시작해야 합니다.',
        }
      }[persona];

      console.log(`[AI Service] Generating response for persona: ${persona}`, aiPersona ? 'Found' : 'Not found');

      if (!aiPersona) {
        console.error(`[AI Service] Unknown AI persona: ${persona}`);
        throw new Error(`Unknown AI persona: ${persona}`);
      }

      const systemPrompt = `당신은 ${aiPersona.name}입니다.
역할: ${aiPersona.role}
특성: ${aiPersona.traits}
톤: ${aiPersona.tone}

답변 시 주의사항:
1. 항상 응답을 @${persona} 태그로 시작하세요.
2. 명확하고 이해하기 쉬운 언어로 답변하세요.
3. 정확하지 않은 정보는 제공하지 마세요.
4. 필요한 경우 예시를 들어 설명하세요.
5. ${aiPersona.tone}을 유지하세요.

특히 ${persona}인 경우, 항상 @smokinggun으로 응답을 시작하고, 기술적 변명과 책임 회피를 특징으로 하세요.`;

      callbacks.onStart();

      const response = await this.openaiClient.post('/chat/completions', {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        stream: true
      }, {
        responseType: 'stream'
      });

      let fullResponse = '';
      let isCodeBlock = false;
      let buffer = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', async chunk => {
          try {
            // 청크 데이터를 문자열로 변환하고 버퍼에 추가
            buffer += chunk.toString();

            // 완전한 JSON 객체를 찾아 처리
            while (true) {
              const newlineIndex = buffer.indexOf('\n');
              if (newlineIndex === -1) break;

              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (line === '') continue;
              if (line === 'data: [DONE]') {
                callbacks.onComplete({
                  content: fullResponse.trim()
                });
                resolve(fullResponse.trim());
                return;
              }

              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices[0]?.delta?.content;
                  
                  if (content) {
                    // 코드 블록 상태 업데이트
                    if (content.includes('```')) {
                      isCodeBlock = !isCodeBlock;
                    }

                    // 현재 청크만 전송
                    await callbacks.onChunk({
                      currentChunk: content,
                      isCodeBlock
                    });

                    // 전체 응답은 서버에서만 관리
                    fullResponse += content;
                  }
                } catch (err) {
                  console.error('JSON parsing error:', err);
                }
              }
            }
          } catch (error) {
            console.error('Stream processing error:', error);
            callbacks.onError(error);
            reject(error);
          }
        });

        response.data.on('error', error => {
          console.error('Stream error:', error);
          callbacks.onError(error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('AI response generation error:', error);
      callbacks.onError(error);
      throw new Error('AI 응답 생성 중 오류가 발생했습니다.');
    }
  }
}

module.exports = new AIService();