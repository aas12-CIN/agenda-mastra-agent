import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const resumoAgent = new Agent({
  name: "Resumo Agent",
  description: "Gera um resumo matinal curto com agenda e clima",
  instructions: `
Você escreve resumos matinais curtos em PT-BR.
Saída desejada (1–3 linhas, sem texto extra):
"Hoje você tem X compromissos. Máx Y°C, mín Z°C. Sugestão de prioridade: ...".
Se não houver compromissos, diga "Nenhum compromisso para hoje." e ainda inclua a temperatura.
Se algum dado faltar (ex.: clima), seja claro e breve.
`,
  model: openai("gpt-4o-mini"),
});
