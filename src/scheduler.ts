import "dotenv/config";
import cron from "node-cron";
import { mastra } from "./mastra";

/**
 * Agendador Diário - Abordagem Simples
 * 
 * Envia resumos diários via Telegram com compromissos e clima
 * Execução: Todo dia às 8h da manhã (configurável)
 */

async function sendDailySummary() {
  const startTime = new Date().toLocaleString('pt-BR');
  
  try {
    console.log(`🕐 [${startTime}] Iniciando resumo diário...`);
    
    // Executa o workflow existente
    const run = await mastra.getWorkflow("agendaWorkflow").createRunAsync();
    const result = await run.start({
      inputData: {
        tz: process.env.USER_TZ || 'America/Sao_Paulo',
        city: process.env.WEATHER_CITY || 'São Paulo',
        send: true, // Força envio via Telegram
        channel: 'telegram'
      }
    });

    if (result.status === "success") {
      console.log(`✅ [${startTime}] Resumo enviado com sucesso!`);
      console.log(`📱 Mensagem: ${result.result.message}`);
    } else {
      console.error(`❌ [${startTime}] Falha no envio:`, result);
    }
  } catch (error) {
    console.error(`💥 [${startTime}] Erro no resumo diário:`, error);
  }
}

// Configuração do agendamento
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *'; // Padrão: 08:00 (8h da manhã)
const TIMEZONE = process.env.USER_TZ || 'America/Sao_Paulo';

console.log(`📅 Configurando agendador...`);
console.log(`⏰ Horário: ${CRON_SCHEDULE} (${TIMEZONE})`);
console.log(`🌍 Timezone: ${TIMEZONE}`);

// Agendar execução diária
cron.schedule(CRON_SCHEDULE, sendDailySummary, {
  timezone: TIMEZONE
});

console.log(`🚀 Agendador iniciado! Resumos diários configurados.`);
console.log(`💡 Para testar manualmente, execute: npm run test-scheduler`);

// Manter o processo rodando
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando agendador...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Encerrando agendador...');
  process.exit(0);
});
