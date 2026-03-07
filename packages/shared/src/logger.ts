import { ApplicationInsightsVersion, createWinstonLogger } from '@shellicar/winston-azure-application-insights';
import applicationinsights from 'applicationinsights';
import { Version } from './version';

applicationinsights.setup().start();

export const client = applicationinsights.defaultClient;
client.context.tags[client.context.keys.applicationVersion] = Version.version;

export const logger = createWinstonLogger({
  insights: {
    client: applicationinsights.defaultClient,
    version: ApplicationInsightsVersion.V3,
  },
  winston: {
    console: {
      enabled: process.env.CONTAINER_APP_NAME === undefined,
    },
  },
});
