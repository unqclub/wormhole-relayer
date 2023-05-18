import { UnqPlugin, UnqRelayerPluginConfig } from "./plugin/unq_plugin";
import { retryVaa } from "./helpers/api.helpers";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { loadFileAndParseToObject } from "relayer-engine/lib/middleware/legacy-plugin";
import { defaultLogger as logger } from "relayer-engine/lib/logging";
import {
  Environment,
  LegacyPluginCompat,
  RelayerApp,
  StandardRelayerApp,
} from "relayer-engine";
import * as dotenv from "dotenv";
import Koa from "koa";
import { Logger } from "winston";
import { CHAIN_ID_POLYGON, CHAIN_ID_SOLANA } from "@certusone/wormhole-sdk";
export const main = async () => {
  const pluginConfig = (await loadFileAndParseToObject(
    `./unqPluginConfig.json`
  )) as UnqRelayerPluginConfig;

  dotenv.config();

  const app = express();

  const env = Environment.TESTNET;
  const wApp = new StandardRelayerApp(env, {
    name: "unq-relayer",
    // redis: {
    //   host: process.env.REDIS_ENDPOINT!,
    //   port: Number(process.env.REDIS_PORT!),
    // },
    // spyEndpoint: `${process.env.SPY_SERVICE_HOST!}:${
    //   process.env.SPY_SERVICE_PORT
    // }`,
    workflows: {
      retries: 3,
    },
    privateKeys: {
      [CHAIN_ID_SOLANA]: [pluginConfig.xDappConfig.networks["sol0"].privateKey],
      [CHAIN_ID_POLYGON]: [
        pluginConfig.xDappConfig.networks["evm0"].privateKey,
      ],
    },

    providers: {
      chains: {
        "1": { endpoints: ["https://api.devnet.solana.com"] },
        "5": {
          endpoints: [
            "https://polygon-mumbai.g.alchemy.com/v2/qBycdF3bdGGhRb8tKel6S3n_iUMr7No1",
          ],
        },
      },
    },
    logger: logger,
  });

  wApp.filters = pluginConfig.spyServiceFilters.map((filter) => {
    return {
      emitterFilter: filter,
    };
  });

  console.log("FILTERS: ", wApp.filters);

  wApp.use(async (err, ctx, next) => {
    ctx.logger.error("error middleware triggered");
  });
  const plugin = new UnqPlugin({} as any, pluginConfig, logger);

  LegacyPluginCompat.legacyPluginCompat(wApp, plugin);

  wApp.listen();

  runUI(wApp, logger);

  app.listen(5500, async () => {
    console.log("Server started....");
  });
  app.use(cors());
  app.use(bodyParser.json());
  app.post("/retry", async (req, res) => {
    const data = await retryVaa(req);
    res.send(data);
  });
};

function runUI(relayer: RelayerApp<any>, logger: Logger) {
  const app = new Koa();

  app.use(relayer.storageKoaUI("/ui"));
  app.use(async (ctx: any, next: any) => {
    if (ctx.request.method !== "GET" && ctx.request.url !== "/metrics") {
      await next();
      return;
    }

    ctx.body = await relayer.metricsRegistry().metrics();
  });

  app.listen(3400, () => {
    logger.info(`Running on ${3400}...`);
    logger.info(`For the UI, open http://localhost:${3400}/ui`);
    logger.info("Make sure Redis is running on port 6379 by default");
  });
}

main().catch((err) => {
  console.log(err);
});
