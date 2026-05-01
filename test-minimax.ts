import { MinimaxClient } from "./src/services/ai/minimax-client";

async function run() {
  console.log("Using API Key length:", process.env.MINIMAX_API_KEY?.length);
  console.log("Using URL:", process.env.MINIMAX_API_URL);

  const res = await MinimaxClient.complete([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Say hello!" }
  ]);

  console.log("Final Response:", res);
}

run().catch(console.error);
