import { parseRobinhood, detectBroker } from "./lib/broker-parsers.ts";

const mockCsv = `Order ID,Process Date,Instrument,Activity Type,Quantity,Price,Settlement Date,Status
ORD123,2026-03-10,AAPL,Buy,10,150.00,2026-03-12,Filled
ORD456,2026-03-11,TSLA,Sell,5,200.00,2026-03-13,Filled
`;

console.log("Detecting broker...");
const broker = detectBroker(mockCsv);
console.log("Detected:", broker);

if (broker === "robinhood") {
  const trades = parseRobinhood(mockCsv);
  console.log("Parsed Trades:", JSON.stringify(trades, null, 2));
  if (trades.length === 2 && trades[0].symbol === "AAPL") {
    console.log("✅ Robinhood Parser PASS");
  } else {
    console.log("❌ Robinhood Parser FAIL");
    process.exit(1);
  }
} else {
  console.log("❌ Broker detection FAIL");
  process.exit(1);
}
