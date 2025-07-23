const axios = require('axios');
const { openaiApiKey } = require('../config/keys');
const amqp = require('amqplib');

class AIService {
  constructor() {
    this.openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    this.amqpConn = null;
    this.amqpChannel = null;
    this.queueName = 'ai-tasks';
    this.initRabbitMQ();
  }

  async initRabbitMQ() {
    try {
      this.amqpConn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      this.amqpChannel = await this.amqpConn.createChannel();
      await this.amqpChannel.assertQueue(this.queueName, { durable: true });
      console.log('[AIService] RabbitMQ 연결 및 큐 준비 완료');
    } catch (err) {
      console.error('[AIService] RabbitMQ 연결 실패:', err.message);
    }
  }

  async publishAITask(task) {
    if (!this.amqpChannel) {
      await this.initRabbitMQ();
    }
    const payload = Buffer.from(JSON.stringify(task));
    await this.amqpChannel.sendToQueue(this.queueName, payload, { persistent: true });
    console.log('[AIService] AI 작업 메시지큐 발행:', task);
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
        }
      }[persona];

      if (!aiPersona) {
        throw new Error('Unknown AI persona');
      }

      const systemPrompt = `당신은 ${aiPersona.name}입니다.
역할: ${aiPersona.role}
특성: ${aiPersona.traits}
톤: ${aiPersona.tone}

답변 시 주의사항:
1. 명확하고 이해하기 쉬운 언어로 답변하세요.
2. 정확하지 않은 정보는 제공하지 마세요.
3. 필요한 경우 예시를 들어 설명하세요.
4. ${aiPersona.tone}을 유지하세요.`;

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

  async consumeAITasks(onResult) {
    if (!this.amqpChannel) {
      await this.initRabbitMQ();
    }
    this.amqpChannel.consume(this.queueName, async (msg) => {
      if (msg !== null) {
        const task = JSON.parse(msg.content.toString());
        try {
          // 실제 AI 응답 생성
          const result = await this.generateResponse(task.query, task.aiName, {
            onStart: () => {},
            onChunk: () => {},
            onComplete: (finalContent) => {
              if (onResult) onResult({ ...task, result: finalContent });
            },
            onError: (error) => {
              if (onResult) onResult({ ...task, error });
            }
          });
        } catch (error) {
          if (onResult) onResult({ ...task, error });
        }
        this.amqpChannel.ack(msg);
      }
    });
  }
}

module.exports = new AIService();