import { createScorer } from "@mastra/core/scores";

export const resumoScorer = createScorer({
  name: "Resumo Quality Scorer",
  description: "Avalia a qualidade dos resumos matinais baseado em completude, formato, clareza e prioridade",
})
  .generateScore(async ({ run }) => {
    console.log("🔍 Scorer Debug - Full run object:", JSON.stringify(run, null, 2));
    
    // Extrair dados do run
    const stepInput = run.input || {};
    const stepOutput = run.output || {};
    
    console.log("🔍 Scorer Debug - stepInput:", JSON.stringify(stepInput, null, 2));
    console.log("🔍 Scorer Debug - stepOutput:", JSON.stringify(stepOutput, null, 2));
    
    // Extrair texto da mensagem (estrutura aninhada)
    const text = stepOutput.object?.message || stepOutput.message || "";
    const events = stepInput[0]?.events || [];
    const weather = stepInput[0]?.weather || {};
    
    console.log("🔍 Scorer Debug - extracted data:", { 
      text, 
      eventsCount: events.length, 
      hasWeather: !!(weather.summary || (weather.min !== null && weather.max !== null))
    });
    
    if (!text) {
      console.log("❌ Scorer: Texto vazio, retornando score 0");
      return 0;
    }
    
    let score = 0;
    
    // Completude (40% - 4 pontos)
    if (events.length > 0) {
      score += 2; // Tem compromissos
      if (text.includes(events.length.toString())) {
        score += 2; // Menciona quantidade correta
      }
    } else {
      if (text.includes("Nenhum compromisso") || text.includes("nenhum compromisso")) {
        score += 4; // Menciona corretamente que não há compromissos
      }
    }
    
    if (weather.summary || (weather.min !== null && weather.max !== null)) {
      score += 1; // Tem dados de clima
      if (/\d+°C/.test(text)) {
        score += 1; // Menciona temperatura
      }
    }
    
    // Formato (30% - 3 pontos)
    if (/Hoje você tem \d+ compromissos/.test(text) || /Nenhum compromisso/.test(text)) {
      score += 1.5; // Segue formato de compromissos
    }
    if (/Máx \d+°C, mín \d+°C/.test(text) || /máx \d+°C, mín \d+°C/.test(text)) {
      score += 1.5; // Segue formato de temperatura
    }
    
    // Clareza (20% - 2 pontos)
    if (text.length >= 20 && text.length <= 300) {
      score += 1; // Tamanho adequado
    }
    if (text.split('.').length >= 2 && text.split('.').length <= 5) {
      score += 1; // Estrutura de frases adequada
    }
    
    // Prioridade (10% - 1 ponto)
    if (/Sugestão|sugestão|Prioridade|prioridade/.test(text)) {
      score += 1; // Inclui sugestão de prioridade
    }
    
    // Normalizar para 0-1 (dividir por 10)
    const normalizedScore = Math.min(score / 10, 1);
    
    console.log(`📊 Scorer: Score calculado = ${score}/10 (${(normalizedScore * 100).toFixed(1)}%)`);

    // Enviar score via Telegram imediatamente após o cálculo (apenas se send=true)
    const shouldSend = stepInput[0]?.send === true;
    
    if (shouldSend) {
      try {
        const percentage = Math.round(normalizedScore * 100);
        const scoreMessage = `📊 Score: ${percentage}%`;
        
        // Enviar score via Telegram
        const { notifyTool } = await import('../tools/notify-tool');
        const { RuntimeContext } = await import('@mastra/core/di');
        
        const runtimeContext = new RuntimeContext();
        await notifyTool.execute({
          context: { message: scoreMessage, channel: 'telegram' },
          runtimeContext,
        });
        
        console.log(`📊 Score enviado via Telegram: ${scoreMessage}`);
      } catch (scoreError) {
        console.error(`⚠️ Erro ao enviar score via Telegram:`, scoreError);
      }
    } else {
      console.log(`📊 Score calculado mas não enviado (send=false): ${Math.round(normalizedScore * 100)}%`);
    }

    return normalizedScore;
  })
  .generateReason(({ score, run }) => {
    const stepOutput = run.output || {};
    const text = stepOutput.object?.message || stepOutput.message || "";
    const stepInput = run.input || [];
    const events = stepInput[0]?.events || [];
    const weather = stepInput[0]?.weather || {};
    
    const reasons = [];
    
    // Completude
    if (events.length > 0) {
      reasons.push(`✅ Menciona ${text.includes(events.length.toString()) ? 'corretamente' : 'incorretamente'} a quantidade de compromissos`);
    } else {
      reasons.push(text.includes("Nenhum compromisso") ? '✅ Menciona corretamente que não há compromissos' : '❌ Não menciona status dos compromissos');
    }
    
    if (weather.summary || (weather.min !== null && weather.max !== null)) {
      reasons.push(`✅ ${/\d+°C/.test(text) ? 'Inclui' : 'Não inclui'} dados de temperatura`);
    }
    
    // Formato
    reasons.push(/Hoje você tem \d+ compromissos/.test(text) || /Nenhum compromisso/.test(text) ? '✅ Segue formato de compromissos' : '❌ Não segue formato de compromissos');
    reasons.push(/Máx \d+°C, mín \d+°C/.test(text) || /máx \d+°C, mín \d+°C/.test(text) ? '✅ Segue formato de temperatura' : '❌ Não segue formato de temperatura');
    
    // Clareza
    reasons.push(text.length >= 20 && text.length <= 300 ? '✅ Tamanho adequado' : '❌ Tamanho inadequado');
    reasons.push(text.split('.').length >= 2 && text.split('.').length <= 5 ? '✅ Estrutura de frases adequada' : '❌ Estrutura de frases inadequada');
    
    // Prioridade
    reasons.push(/Sugestão|sugestão|Prioridade|prioridade/.test(text) ? '✅ Inclui sugestão de prioridade' : '❌ Não inclui sugestão de prioridade');
    
    return `Score: ${(score * 10).toFixed(1)}/10\n${reasons.join('\n')}`;
  });
