import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://87c45a5eaa9c6e7ad97a75809c034aa0@o4511489982332928.ingest.us.sentry.io/4511489986527232",
  tracesSampleRate: 1.0,
  debug: false,
});
