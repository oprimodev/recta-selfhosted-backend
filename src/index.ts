import 'dotenv/config';

// Set timezone to UTC-3 (Brazil)
process.env.TZ = 'America/Sao_Paulo';

// REGRA DE NEGÓCIO: Detectar se deve executar cron job ou servidor HTTP
// Se RAILWAY_CRON_SERVICE=true, executa o cron job e termina
// Caso contrário, inicia o servidor HTTP normalmente
const isCronService = process.env.RAILWAY_CRON_SERVICE === 'true';

if (isCronService) {
  // Executar cron job e terminar
  import('./jobs/processRecurrences.js').then(({ runCronJob }) => {
    runCronJob();
  }).catch((error) => {
    console.error('❌ Fatal error running cron job:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  });
} else {
  // Iniciar servidor HTTP normalmente
  import('./app.js').then(({ startServer }) => {
    startServer().catch((error) => {
      console.error('❌ Fatal error starting server:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    });
  });
}






