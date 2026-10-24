import { loadConfig } from "./src/config.js";
import { createApp, createFacilitator } from "./src/app.js";

const config = loadConfig();
const app = createApp(config, await createFacilitator(config));

app.listen(config.port, () => {
  console.log(`Soft Reboot is open at ${config.publicUrl}`);
  if (config.payments) {
    console.log(`Hugs cost ${config.price} on ${config.network.label}, paid to ${config.payTo}`);
  } else {
    console.log("Free mode: PAY_TO is not set, so hugs are free. Set PAY_TO to start charging.");
  }
});
