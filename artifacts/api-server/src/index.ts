import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/seed";
import { runStartupMigrations } from "./lib/migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runStartupMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      // Auth-recovery transport guard: the email helper currently log-only
      // delivers verification + password-reset URLs. In production this means
      // users cannot self-recover unless an SMTP/Resend/SES transport is
      // wired into artifacts/api-server/src/lib/email.ts deliver(). Surface
      // the gap loudly at boot so it's visible in deployment logs.
      if (process.env.NODE_ENV === "production") {
        logger.warn(
          {},
          "[email] no transactional email transport configured — verification and password-reset emails will NOT be delivered. Wire a real transport in lib/email.ts before relying on self-serve recovery.",
        );
      }

      seedIfEmpty().catch((e) => logger.error({ err: e }, "Seed error"));
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup migration failed — server will not start");
    process.exit(1);
  });
