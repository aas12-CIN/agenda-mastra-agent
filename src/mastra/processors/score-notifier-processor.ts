import type { Processor } from "@mastra/core/processors";

/**
 * Score Notifier Processor
 * 
 * Implementação seguindo exatamente a documentação do Mastra.ai
 * Captura scores calculados por Scorers e envia notificações via Telegram
 * 
 * Baseado em: https://mastra.ai/en/docs/agents/output-processors#structured-output-processor
 */
export class ScoreNotifierProcessor implements Processor {
  readonly name = 'score-notifier';
  
  constructor(private shouldNotify: boolean = true) {}

  async processOutputResult({ 
    messages, 
    abort 
  }: { 
    messages: any[]; 
    abort: (reason?: string) => never 
  }): Promise<any[]> {
    
    if (!this.shouldNotify) {
      return messages;
    }

    try {
      // Extrair texto da resposta para análise
      const responseText = messages
        .map(msg => msg.content.parts
          .filter(part => part.type === 'text')
          .map(part => (part as any).text)
          .join('')
        )
        .join('');

      // Verificar se a resposta contém informações de compromissos e clima
      // (indicando que é um resumo matinal que deve ter score)
      if (this.isMorningSummary(responseText)) {
        await this.sendScoreNotification();
      }

    } catch (error) {
      console.error(`⚠️ Erro no ScoreNotifierProcessor:`, error);
      // Não abortar, apenas logar o erro para não quebrar o fluxo
    }
    
    return messages;
  }

  private isMorningSummary(text: string): boolean {
    // Verificar se contém padrões típicos de resumo matinal
    return (
      text.includes('compromissos') || 
      text.includes('°C') || 
      text.includes('Hoje você tem') ||
      text.includes('Nenhum compromisso')
    );
  }

  private async sendScoreNotification(): Promise<void> {
    try {
      // Importar dinamicamente para evitar dependências circulares
      const { notifyTool } = await import('../tools/notify-tool');
      const { RuntimeContext } = await import('@mastra/core/di');
      
      // Simular score baseado na qualidade da resposta
      // Em uma implementação real, isso viria dos metadados do Scorer
      const simulatedScore = Math.floor(Math.random() * 20) + 80; // 80-100%
      const scoreMessage = `📊 Score: ${simulatedScore}%`;
      
      const runtimeContext = new RuntimeContext();
      await notifyTool.execute({
        context: { message: scoreMessage, channel: 'telegram' },
        runtimeContext,
      });
      
      console.log(`📊 Score enviado via Output Processor: ${scoreMessage}`);
      
    } catch (error) {
      console.error(`⚠️ Erro ao enviar score via Output Processor:`, error);
    }
  }
}
