import "dotenv/config";
import cron from "node-cron";
import { mastra } from "./mastra";

/**
 * Daily Scheduler (simple version)
 * 
 * Sends a daily summary via Telegram with appointments and weather forecast.
 * Run time: every day at 8 AM (configurable).
 */

export async function sendDailySummary() {
  const startTime = new Date().toLocaleString('pt-BR');
  
  try {
    console.log(`🕐 [${startTime}] Iniciando resumo diário...`);
    
    // Runs the existing workflow
    const run = await mastra.getWorkflow("agendaWorkflow").createRunAsync();
    const result = await run.start({
      inputData: {
        tz: process.env.USER_TZ || 'America/Sao_Paulo',
        city: process.env.WEATHER_CITY || 'São Paulo',
        send: true, // Manually trigger sending via Telegram
        channel: 'telegram'
      }
    });

    if (result.status === "success") {
      console.log(`✅ [${startTime}] Resumo enviado com sucesso!`);
      console.log(`📱 Mensagem: ${result.result.message}`);
      console.log(`📊 Score será enviado automaticamente pelo Mastra Scorer`);
    } else {
      console.error(`❌ [${startTime}] Falha no envio:`, result);
    }
  } catch (error) {
    console.error(`💥 [${startTime}] Erro no resumo diário:`, error);
  }
}

// Scheduling setup
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '00 8 * * *'; 
const TIMEZONE = process.env.USER_TZ || 'America/Sao_Paulo';

console.log(`📅 Configurando agendador...`);
console.log(`⏰ Horário: ${CRON_SCHEDULE} (${TIMEZONE})`);
console.log(`🌍 Timezone: ${TIMEZONE}`);

// Set up daily run 
cron.schedule(CRON_SCHEDULE, sendDailySummary, {
  timezone: TIMEZONE
});

console.log(`🚀 Agendador iniciado! Resumos diários configurados.`);
console.log(`💡 Para testar manualmente, execute: npm run test-scheduler`);

// Keep the process running 
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando agendador...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Encerrando agendador...');
  process.exit(0);
});
